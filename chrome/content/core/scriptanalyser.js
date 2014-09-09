/* See license.txt for terms of usage */
//
// Import for the JagerMonkey parser API.
// Components.utils.import("resource://gre/modules/reflect.jsm");
// We use a special type of import for the function leaf as it is used by this module and its
// worker
Components.utils.import("chrome://firestorm/content/lib/functionTree.js");
Components.utils.import("resource://gre/modules/reflect.jsm");

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firebug/lib/url",
    "firestorm/lib/utils",
],
function(Obj, FBTrace, URL, Utils) {


// ********************************************************************************************* //
// ScriptAnalyser Module Implementation
// 
Firebug.ScriptAnalyser = Obj.extend(Firebug.Module,
{
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Initialization & Shutdown

    /**
     * Module function called for the module initialisation. It creates the worker that computes
     * the static code analysis.
     * 
     * @param  {Panel} owner
     * @return {void}       
     */
    initialize: function(owner)
    {
        Firebug.Module.initialize.apply(this, arguments);

        // Module initialization (there is one module instance per browser window)
        try{
            this.worker = new Worker("chrome://firestorm/content/core/scriptAnalyserWorker.js");

            var self = this;
            this.worker.onmessage = function(event){
                self.onworkermessage.call(self,event);
            };
            
            this.worker.postMessage({command: "ping"});
        } catch(e){
            if (FBTrace.DBG_FIRESTORM)
                FBTrace.sysout("fireStorm; ScriptAnalyser.initialize.EXCEPTION", {
                    "EXCEPTION": e
                });
        }


        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ScriptAnalyser.initialize", {
                "owner": owner,
                "this": this
            });
            
    },

    /**
     * Module function called at shutdown. It terminates the worker and shutdowns this module
     * 
     * @return {void} 
     */
    shutdown: function()
    {

        this.worker.terminate();
        Firebug.Module.shutdown.apply(this, arguments);

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ScriptAnalyser.shutdown");
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Event trigered functions

    /**
     * Populates the analysis stack respecting the dependency order
     * 
     * @param  {Array}      sourceFiles     List of all the source files
     * @return {void}             
     */
    populateAnalysisStack: function(sourceFiles)
    {

        for (var j = sourceFiles.length ; j >= 0; j--){
            if (!this.isAnalysed(sourceFiles[j])){
                this.context.Firestorm.analysisStack.push(sourceFiles[j]);
            }
        }

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ScriptAnalyser.populateAnalysisStack", {
                "sourceFiles": sourceFiles,
                "Stack": this.context.Firestorm.analysisStack,
                "context": this.context
            });  

        this.analyse(this.context.Firestorm.analysisStack.pop());
    },

    /**
     * Creates the empty function tree for the current context. And launches the analysis
     *  for the first script of the page, if there is one, by calling the analyse method.
     *  
     * @param  {Context} context page context
     * @return {void}
     */
    loadedContext: function(context)
    {
        context.Firestorm = {};
        context.Firestorm.functionTree = new FunctionTree(context.name);
        

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ScriptAnalyser.loadedContext", {
                "this": this,
                "context": context
            });
        context.Firestorm.analysisStack = [];

        this.context = context;     
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Worker handling

    /**
     * This method handles messages coming from the worker.
     * 
     * @param  {Event} event event containing the message content
     * @return {void}
     */
    onworkermessage: function(event)
    {
        if (FBTrace.DBG_FIRESTORM && event.data.debug)
            FBTrace.sysout(event.data.payload.header, {
                "Message content": event.data.payload.content
            });

        if (event.data.payload.type === "analysisResponse"){

            this.context.Firestorm.functionTree = cloneFunctionTree(event.data.payload.content);
            if (this.context.Firestorm.analysisStack.length > 0)
                this.analyse(this.context.Firestorm.analysisStack.pop());
            else
                this.context.Firestorm.Analysisfinished = true;

        }
    },

    /**
     * Method to send the analysis command to the worker.
     * 
     * @param  {functionTree} functionTree   Function tree
     * @param  {String}       str            Script content as a String
     * @return {void}
     */
    startWorkerAnalysis: function(functionTree, str)
    {
        this.worker.postMessage({
            command: "analyse",
            payload: {
                "functionTree": functionTree,
                "ast": Reflect.parse(str, {source: true, loc: true}),
                "source": str
            }
        });
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Private helpers
    // 
    
    /**
     * Method called to launch a script page analysis. It starts by retrieving the script
     *  content.
     *  
     * @param  {sourceFile}      sourceFiles Array containing the source files
     * @return {void}
     */
    analyse: function(sourceFile)
    {
        if(sourceFile){
            // A function leaf in the tree is built from the path its related to
            var script = new FunctionLeaf("/"+Utils.getFileName(sourceFile.href));
            this.context.Firestorm.functionTree.appendChild(script);

            sourceFile.loadScriptLines(function(scriptLoaded){
                if (FBTrace.DBG_FIRESTORM)
                    FBTrace.sysout("fireStorm; ScriptAnalyser.analyse", {
                        "loadedScript": scriptLoaded
                    });


                Firebug.ScriptAnalyser.startWorkerAnalysis(
                    Firebug.ScriptAnalyser.context.Firestorm.functionTree,
                    Utils.linesArrayToString(scriptLoaded),
                    scriptLoaded.length +1
                );
                
            });
        }else{
            this.context.Firestorm.Analysisfinished = true;
        }

    },

    /**
     * Function to check wheather or not a source file has already been analysed.
     * 
     * @param  {SourceFile}  sourceFile Source File to check
     * @return {Boolean}                true if is already in the tree, false otherwise.
     */
    isAnalysed: function(sourceFile)
    {
        if(this.context.Firestorm.functionTree.hasChildren()){

            var children = this.context.Firestorm.functionTree.getChildren();

            for (var i = 0 ; i<children.length ; i++){

            if (FBTrace.DBG_FIRESTORM)
                FBTrace.sysout("fireStorm; ScriptAnalyser.isAnalized", {
                    "sourceFiles": children,
                    "Utils.getFileName(sourceFile.href)": Utils.getFileName(sourceFile.href)
                });  
                if (children[i].getName() === Utils.getFileName(sourceFile.href)){
                    return true;
                }
            }
        }
            
        return false;
    },
    

});

// ********************************************************************************************* //
// Registration

Firebug.registerModule(Firebug.ScriptAnalyser);

return Firebug.ScriptAnalyser;

// ********************************************************************************************* //
});
