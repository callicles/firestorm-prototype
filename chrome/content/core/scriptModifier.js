/* See license.txt for terms of usage */

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firestorm/lib/utils",
    "firestorm/core/modelHandler"
],
function(Obj, FBTrace, Utils, ModelHandler) {

    const DBG_MODIFIER = true;

    const Cc = Components.classes;
    const Ci = Components.interfaces;
    const SCRIPT_CONTENT_TYPE = "application/javascript";

    var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

// ********************************************************************************************* //
// Traffic Observer implementation
// 
// This is class helpers to handle properly the events triggered by Firefox.


    /**
     * Observer of incomming requests and responses
     * @type {Object}
     */
    var httpRequestObserver =
    {
        observe: function(aSubject, aTopic, aData)
        {
            if (aTopic == "http-on-examine-response" || aTopic == "http-on-examine-cached-response" ||
                aTopic == "http-on-examine-merged-response") {
                var newListener = new TracingListener();
                aSubject.QueryInterface(Ci.nsITraceableChannel);
                newListener.originalListener = aSubject.setNewListener(newListener);
            }
        },

        QueryInterface : function (aIID)
        {
            if (aIID.equals(Ci.nsIObserver) ||
                aIID.equals(Ci.nsISupports))
            {
                return this;
            }

            throw Components.results.NS_NOINTERFACE;

        }
    };

    function CCIN(cName, ifaceName) {
        return Cc[cName].createInstance(Ci[ifaceName]);
    }

    /**
     * Listener of net events.
     */
    function TracingListener() {
        this.originalListener = null;
    }

    TracingListener.prototype =
    {
        onDataAvailable: function(request, context, inputStream, offset, count)
        {
            var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1",
                    "nsIBinaryInputStream");
            var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
            var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1",
                    "nsIBinaryOutputStream");

            binaryInputStream.setInputStream(inputStream);
            storageStream.init(8192, count, null);
            binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

            // Copy received data as they come.
            var data = binaryInputStream.readBytes(count);

            if (ScriptModifier.interceptionActivated && request.contentType == SCRIPT_CONTENT_TYPE &&   // Filters the script
                ScriptModifier.getScriptNamefromURI(request.name) === ScriptModifier.selectedScript){

                if ((offset < ScriptModifier.functionLeaf.range.end && (offset+count) >                 // Filters the buffer for the modification
                    ScriptModifier.functionLeaf.range.end && (!ScriptModifier.functionLeaf.fromObject
                        || (!ScriptModifier.functionLeaf.fromObject.endIndex && 
                            ScriptModifier.functionLeaf.fromObject.name))) || 
                    (offset < ScriptModifier.functionLeaf.fromObject.endIndex && (offset+count) > 
                    ScriptModifier.functionLeaf.fromObject.endIndex )){

                    data = ScriptModifier.alterScript(data, offset);

                    ScriptModifier.desactivate();

                    if (FBTrace.DBG_FIRESTORM && DBG_MODIFIER)
                        FBTrace.sysout("fireStorm; ScriptModifier.onDataAvailable", {
                            request: request,
                            context: context,
                            inputStream: inputStream,
                            offset: offset,
                            count: count,
                            data:data
                        });
                }
            }

            binaryOutputStream.writeBytes(data, data.length);

            this.originalListener.onDataAvailable(request, context,
                storageStream.newInputStream(0), offset, data.length);
        },

        onStartRequest: function(request, context) 
        {
            this.originalListener.onStartRequest(request, context);
        },

        onStopRequest: function(request, context, statusCode)
        {
            this.originalListener.onStopRequest(request, context, statusCode);
        },

        QueryInterface: function (aIID) 
        {
            if (aIID.equals(Ci.nsIStreamListener) ||
                aIID.equals(Ci.nsISupports)) {
                return this;
            }
            throw Components.results.NS_NOINTERFACE;
        }
    }

// ********************************************************************************************* //
// ScriptModifier Implementation
// 
// This Script Modifier is the module that's in charge of getting a script file and modifing it so
// that it can be used by the fuzzing handler to trigger the function execution.

var ScriptModifier = Obj.extend(Firebug.Module,
{                                                                        

    interceptionActivated: false,
    dataBatch: undefined,

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module Methods

    initialize: function(owner)
    {
        Firebug.Module.initialize.apply(this, arguments);

        observerService.addObserver(httpRequestObserver,"http-on-examine-response", false);
        observerService.addObserver(httpRequestObserver,"http-on-examine-cached-response", false);
        observerService.addObserver(httpRequestObserver,"http-on-examine-merged-response", false);

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ScriptModifier.initialize");
    },

    shutdown: function()
    {
        Firebug.Module.shutdown.apply(this, arguments);

        observerService.removeObserver(httpRequestObserver,"http-on-examine-response");
        observerService.removeObserver(httpRequestObserver,"http-on-examine-cached-response");
        observerService.removeObserver(httpRequestObserver,"http-on-examine-merged-response");

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ScriptModifier.shutdown");
    },   



    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // ScriptModifier Methods
    // 
    
    /**
     * Activates the script interception 
     * 
     * @return {void} 
     */
    activate: function(){
        this.interceptionActivated = true;
    },

    /**
     * desactivates script interception at the end of the fuzzing.
     * 
     * @return {void} 
     */
    desactivate: function(){
        this.interceptionActivated = false;
    },

    /**
     * Setup the modifier so that it will intercept the right scripts and modify them accordingly
     * 
     * @param {Object}  context   context of the current webpage
     * @param {Array}   data      databatch to be used for fuzzing.
     * @param {Array}   depArgs   Dependencies arguments
     */
    setScriptModifications: function(context, data, depArgs){
        this.dataBatch = [];
        for (var i = 0 ; i < data.length ; i++){
            this.dataBatch.push(data[i]);
        }
        this.context = context;
        this.functionLeaf = context.Firestorm.selectedFunction.repObject.value;
        this.selectedScript = this.getScriptName(this.functionLeaf.path[0]);
        this.depArgs = depArgs;

        if (FBTrace.DBG_FIRESTORM && DBG_MODIFIER)
            FBTrace.sysout("fireStorm; ScriptModifier.setScriptModifications", {
                context: this.context,
                functionLeaf: this.functionLeaf,
                selectedScript: this.selectedScript,
                dataBatch: this.dataBatch
            });
    },

    /**
     * Alter the data element passed to the function so that the fuzzing function can be executed.
     * 
     * @param  {String}     data    Script extract
     * @param  {Integer}    offset  index offset at the begining of the data extract    
     * @return {String}             Modified Script
     */
    alterScript: function(data, offset){
        if (this.dataBatch.length > 0){
            var level = this.getNestedDegree(this.functionLeaf),
                toEval = this.dataBatch.pop();                                             

            if (level > 1){

                var dependencies = this.functionLeaf.getDependencies(this.context.Firestorm.functionTree);

                for (var i = 0 ; i< dependencies.length ; i++){

                    if (dependencies[i].fromObject){
                        data = this.insertLinesIntoScript(
                            data,
                            offset,
                            dependencies[i].fromObject.endIndex,
                            [ dependencies[i].getName()+'('+this.depArgs[i].join(',')+"); \n"]
                        );
                    } else {
                        data = this.insertLinesIntoScript(
                            data,
                            offset,
                            dependencies[i].range.end,
                            [ dependencies[i].getName()+'('+this.depArgs[i].join(',')+"); \n"]
                        );
                    }

                };

                if (!toEval.args.length){
                    if (this.functionLeaf.fromObject){
                        return this.insertLinesIntoScript(
                            data, 
                            offset ,
                            this.functionLeaf.fromObject.endIndex,
                            this.generatePostMessageScript(
                                "fuzzingInitResponse",
                                toEval.uuid
                            )                      
                        );
                    } else if (this.functionLeaf.getName().startsWith("AnnonymousFunction")){
                        return this.insertLinesIntoScript(
                            data, 
                            offset, 
                            this.functionLeaf.endForAnnonymous,
                            this.generatePostMessageScript(
                                "fuzzingInitResponse",
                                toEval.uuid
                            )
                        );
                    } else {
                        return this.insertLinesIntoScript(
                            data, 
                            offset, 
                            this.functionLeaf.range.end,
                            this.generatePostMessageScript(
                                "fuzzingInitResponse",
                                toEval.uuid
                            )
                        );
                    }
                } else {
                    if (this.functionLeaf.fromObject){
                        return this.insertLinesIntoScript(
                            data, 
                            offset ,
                            this.functionLeaf.fromObject.endIndex,
                            this.generatePostMessageScript(
                                "fuzzingResponse",
                                toEval.uuid,
                                {
                                    "fct": Utils.getFileName(this.functionLeaf.path[0]),
                                    "args": toEval.args.join(',')
                                }
                            )                      
                        );

                    } else if (this.functionLeaf.getName().startsWith("AnnonymousFunction")){
                        return this.insertLinesIntoScript(
                            data, 
                            offset, 
                            this.functionLeaf.endForAnnonymous,
                            this.generatePostMessageScript(
                                "fuzzingResponse",
                                toEval.uuid,
                                {
                                    "fct": Utils.getFileName(this.functionLeaf.path[0]),
                                    "args": toEval.args.join(','),
                                    "functionArgs": this.functionLeaf.args.join(','),
                                    "functionSource": this.functionLeaf.functionSource[0]               
                                }
                            )
                        );
                    } else {
                        return this.insertLinesIntoScript(
                            data, 
                            offset ,
                            this.functionLeaf.range.end ,
                            this.generatePostMessageScript(
                                "fuzzingResponse",
                                toEval.uuid,
                                {
                                    "fct": Utils.getFileName(this.functionLeaf.path[0]),
                                    "args": toEval.args.join(',')
                                }
                            )                      
                        );
                    }
                }
            } else {
                if (!toEval.args.length){

                    if (this.functionLeaf.fromObject){
                        return this.insertLinesIntoScript(
                            data, 
                            offset ,
                            this.functionLeaf.fromObject.endIndex,
                            [" window.onload = function(){"].concat(this.generatePostMessageScript(
                                "fuzzingInitResponse",
                                toEval.uuid
                            )).concat(["};"])               
                        );
                    } else if (this.functionLeaf.getName().startsWith("AnnonymousFunction")){
                        return this.insertLinesIntoScript(
                            data, 
                            offset, 
                            this.functionLeaf.endForAnnonymous,
                            [" window.onload = function(){"].concat(this.generatePostMessageScript(
                                "fuzzingResponse",
                                toEval.uuid
                            )).concat(["};"])
                        );
                    } else {
                        return this.insertLinesIntoScript(
                            data, 
                            offset, 
                            this.functionLeaf.range.end,
                            [" window.onload = function(){"].concat(this.generatePostMessageScript(
                                "fuzzingInitResponse",
                                toEval.uuid
                            )).concat(["};"])
                        );
                    }
                } else {

                    toEval.args = toEval.args.map(function(element){                                    // If the argument is a String we want to add some quotes
                        if (typeof element === "string")                                                // fore the execution
                            return '"'+element+'"';
                        else
                            return element; 
                    })

                    if (this.functionLeaf.fromObject){
                        return this.insertLinesIntoScript(
                            data, 
                            offset ,
                            this.functionLeaf.fromObject.endIndex,
                            [" window.onload = function(){"].concat(this.generatePostMessageScript(
                                "fuzzingResponse",
                                toEval.uuid,
                                {
                                    "fct": Utils.getFileName(this.functionLeaf.path[0]),
                                    "args": toEval.args.join(',')
                                }
                            )).concat(["};"])               
                        );
                    } else if (this.functionLeaf.getName().startsWith("AnnonymousFunction")){
                        return this.insertLinesIntoScript(
                            data, 
                            offset, 
                            this.functionLeaf.endForAnnonymous,
                            [" window.onload = function(){"].concat(this.generatePostMessageScript(
                                "fuzzingResponse",
                                toEval.uuid,
                                {
                                    "fct": Utils.getFileName(this.functionLeaf.path[0]),
                                    "args": toEval.args.join(','),
                                    "functionArgs": this.functionLeaf.args.join(','),
                                    "functionSource": this.functionLeaf.functionSource[0]               
                                }
                            )).concat(["};"])
                        );
                    } else {
                        return this.insertLinesIntoScript(
                            data, 
                            offset ,
                            this.functionLeaf.range.end,
                            [" window.onload = function(){"].concat(this.generatePostMessageScript(
                                "fuzzingResponse",
                                toEval.uuid,
                                {
                                    "fct": Utils.getFileName(this.functionLeaf.path[0]),
                                    "args": toEval.args.join(',')
                                }
                            )).concat(["};"])               
                        );
                    }
                }
            }
        } else {
            return data;
        }
    },

    /**
     * Method that generates the postMessage script to send info to the content script
     * 
     * @param  {String} type class of the posted message.
     * @param  {String} uuid id identifying the request
     * @param  {String} fct  function to be called. If not present, no function will be called, only
     *                       the environment variables will be backed up.
     * @param  {String} args Arguments to feed to the function
     * @return {Array}       Array of all the lines of the generated script.
     */
    generatePostMessageScript: function(type, uuid, options){
        var toReturn = [];

        if (options && options.functionSource)
            toReturn = toReturn.concat([
                "function "+options.fct+'('+options.functionArgs+'){',
                "   "+options.functionSource,
                '};'
            ]);

        toReturn = toReturn.concat([
            "try{",
            "   postMessage({",
            "       debug: false,",
            "       class: '"+type+"',",
            "       payload: {",
            "           uuid: '"+uuid+"',"
            ]);

        if (options && options.fct)
            toReturn.push("           returnedValue: "+options.fct+'('+options.args+"),");

        toReturn = toReturn.concat([
            "           returnedHTML: document.documentElement.outerHTML,",
        //  "           returnedContext: JSON.stringify(window, censor, '\t'),",
            "           returnedCallstack: [],", //TODO !!!! ---> TODO
            "           error: false",
            "       },",
            "   }, '*')",
            "} catch (e) {",
            "   postMessage({",
            "       debug: false,",
            "       class: '"+type+"',",
            "       payload: {",
            "           uuid: '"+uuid+"',",
            "           returnedValue: undefined,",
            "           returnedHTML: undefined,",
        //    "           returnedContext: undefined,",
            "           returnedCallstack: undefined,", //TODO !!!! ---> TODO
            "           error: e.toString()",
            "       },",
            "   }, '*');",
            "};"
        ]);
        return toReturn;
    },

    /**
     * Method used to insert the fuzzing payload into the function's super script
     * 
     * @param  {String}  data           extract of the js file to modify
     * @param  {Integer} offset         offset gicing the index of the begining of the data String in 
     *                                  the original file
     * @param  {Integer} index          Index on where to insert the lines                           
     * @param  {Array}   linesToInsert  Lines to insert into the super script
     * @return {String}                 The new script as a string
     */
    insertLinesIntoScript: function(data, offset, index, linesToInsert)
    {
        var toInsert = linesToInsert.join(' \n ');

        if (data[index-offset+1] != ';')
            return data.substring(0, index-offset+1)+toInsert+data.substring(index-offset+1);
        else
            return data.substring(0, index-offset+2)+toInsert+data.substring(index-offset+2);
    },

    /**
     * Get the Nested degree of a function
     * 
     * @param  {FunctionLeaf} functionLeaf function to get the nested degree from
     * @return {Integer}                   nested Degree
     */
    getNestedDegree: function(functionLeaf)
    {
        var path = functionLeaf.getPath();

        return path.split('/').length - 2;
    },

    /**
     * This function retrieves an original script as a SourceFile Object
     * @param  {String}  path   functionLeaf's path 
     * @return {String}         File name
     */
    getScriptName: function(path)
    {
        var sourceFileName = path.substring(1);
        return sourceFileName.substring(0, sourceFileName.indexOf('/'));
    },

    /**
     * Gets script file name froma uri
     * @param  {String} uri URI of the script
     * @return {String}     File name
     */
    getScriptNamefromURI: function(uri)
    {
        return uri.substring(uri.lastIndexOf('/')+1);
    }
    
});


// ********************************************************************************************* //
// Registration

Firebug.registerModule(ScriptModifier);

return ScriptModifier;

// ********************************************************************************************* //
});
