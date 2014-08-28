/* See license.txt for terms of usage */


define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firestorm/core/scriptModifier",
    "firestorm/core/modelHandler"
],
function(Obj, FBTrace, ScriptModifier, modelHandler) {

var uuidGenerator = Components.classes["@mozilla.org/uuid-generator;1"]
    .getService(Components.interfaces.nsIUUIDGenerator);

Components.utils.import("resource://gre/modules/jsdebugger.jsm");
/**
 * Global variable to ease worker loading.
 * @type {String}
 */
const contentPath = "chrome://firestorm/content";
const DBG_DISPATCHER = true;

// ********************************************************************************************* //
// Dispatcher Implementation
// 
// The dispatcher is the heart of the framework, It is the element that will call the brain and the
// detection Module. It will receive fuzzing instructions from the view (fuzzingSidePanel.js) and
// ask for batches of data to fuzz. Instanciate page workers in order to execute the fuzzed
// function in the right context. Send the results to the detection module. Send the displayable
// results to the result view.

var Dispatcher = Obj.extend(Firebug.Module,
{
    pageworkers: [],
    dbg: undefined,
    brainWorker: undefined,
    detectionWorker: undefined,
    previousBatch: [],
    currentBatch: [],
    toSendToDetection: [],
    batchSize: 0,
    batchFuzzingCursor: 0,
    depArgs : [],                                                                             

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module Methods

    initialize: function(owner)
    {
        Firebug.Module.initialize.apply(this, arguments);

        this.dbg = new Debugger

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; Dispatcher.initialize");
    },

    shutdown: function()
    {
        Firebug.Module.shutdown.apply(this, arguments);

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; Dispatcher.shutdown");
    },

    loadedContext: function(context)
    {
        this.context = context;
        this.cleanUpDispatcher();

        addDebuggerToGlobal(this.context.window);
        dbg.addDebuggee(this.context.window);

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; Dispatcher.loadedContext");
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Dispatcher Methods

    /**
     * This method is responsible for instanciating the brain module (for now it is just the default
     * no brainer module), sending it the generation map and instanciating the detection worker module.
     * 
     * @param  {Object}     generationMap   This object represent the link between each argument and
     *                                      their attributed genrator.
     * @param  {String}     detectionModule fileName of the detection module to instanciate.
     * @param  {Integer}    batchSize       Size of the data batch used for te fuzzing.
     * param   {Array}      depArgs         Dependencies arguments
     * @return {void}                 
     */
    dispatch: function(generationMap, detectionModule, brain, batchSize, depArgs){

        modelHandler.updateFuzzingProgress(0); 
        this.depArgs = depArgs;                                                                         // We tell everything that needs it that we are starting
                                                                                                        // the fuzzing process

        if (!brain)                                                                                     // The default brain is the noBrainModule. It will just 
            brain = "noBrainModule.js";                                                                 // serve as a proxy for now.
        this.batchFuzzingCursor = 0;
        this.batchSize = batchSize;
        if (!this.brainWorker){
            this.brainWorker = new Worker(contentPath+"/brains/"+brain);                                // TODO When enbaling brains, one should change this
                                                                                                        // condition to allow other brains than noBrain
            var self = this;                                                                            // to be used
            this.brainWorker.onmessage = function(e){
                self.workerMessageHandler.call(self,e);
            };

            this.brainWorker.onerror = function (event){
                FBTrace.sysout("fireStorm; moduleIndexer.brainWorker.ERROR",{
                    "event": event
                });
            };
        }

        this.brainWorker.postMessage({
                command: "initializeBrain",
                payload: generationMap
        });

        if (this.detectionWorker)
            this.detectionWorker.terminate();

        this.detectionWorker = new Worker(contentPath+"/detection/"+detectionModule);

        var self = this;

        this.detectionWorker.onmessage = function(e){
            self.workerMessageHandler.call(self,e);
        };

        this.detectionWorker.onerror = function (event){
            FBTrace.sysout("fireStorm; moduleIndexer.detectionWorker.ERROR",{
                "event": event
            });
        };

        if (FBTrace.DBG_FIRESTORM && DBG_DISPATCHER)
            FBTrace.sysout("fireStorm; Dispatcher.dispatch",{
                "generationMap": generationMap,
                "detectionModule": detectionModule,
                "brain": brain,
                "batchSize": batchSize,
                "detectionWorker": this.detectionWorker,
                "brainWorker": this.brainWorker
            });


    },

    /**
     * Function that creates the page worker in order to execute the fuzzing.
     * 
     * @param  {Object} dataBatch Batch of data to fuzz
     * @return {void} 
     */
    fuzzFunction: function(dataBatch){

        //const { ready } = Firebug.JetpackRequire("sdk/addon/window");

        this.currentBatch = this.idDataBatchElements(dataBatch);

        if (FBTrace.DBG_FIRESTORM && DBG_DISPATCHER)
            FBTrace.sysout("fireStorm; Dispatcher.fuzzFunction", {
                "currentBatch": this.currentBatch,
                "dataBatch": dataBatch
            });
                                                                                                        // We added the init request to the batch size
        ScriptModifier.setScriptModifications(
            this.context,
            this.currentBatch,
            this.depArgs                                                                                                                                                                      
        );                                                                                              
                                                                                                        
       
        this.fuzzBatch();
        
        if (FBTrace.DBG_FIRESTORM && DBG_DISPATCHER)
            FBTrace.sysout("fireStorm; Dispatcher.fuzzFunction.end", {
                "pageworkers": this.pageworkers,
                "currentBatch": this.currentBatch
            });
    },

    /**
     * Generates 10 workers that will trigger the fuzzing for 10 functions. This method is called at
     * the begining of the fuzzing and every time 10 fuzzing results are received.
     * 
     * @return {void} 
     */
    fuzzBatch: function(){

        const { ready } = Firebug.JetpackRequire("sdk/addon/window");

        var self = this;

        this.dbg.onEnterFrame = function (frame){
                FBTrace.sysout("fireStorm; debugger ",{
                            "frame": frame
                        });
        }

        ready.then(
            function onfullFill(){
                let pageWorkerBuilder = Firebug.JetpackRequire("sdk/page-worker");

                if(self.batchFuzzingCursor< self.batchSize+1){
                    ScriptModifier.activate();

                    self.pageworkers.push(pageWorkerBuilder.Page({
                        contentScriptFile: "resource://firestorm/chrome/content/core/contentScript.js",
                        contentURL: self.context.name,
                        contentScriptWhen: "start"
                    }));

                    self.pageworkers[self.pageworkers.length-1].port.on('data', function(data){
                        self.handleFuzzingWorkerResponse(data);
                    });
                    self.pageworkers[self.pageworkers.length-1].port.on('error1', function(data){
                         FBTrace.sysout("fireStorm; Dispatcher.PageWorker ERROR 1",{
                            "Error": data
                        });
                    });
                    self.pageworkers[self.pageworkers.length-1].port.on('error2', function(data){
                         FBTrace.sysout("fireStorm; Dispatcher.PageWorker ERROR 2",{
                            "Error": data
                        });
                    });
                }

            },
            function onRejection(rejection){
                FBTrace.sysout("Promise rejected",rejection);
            }
        );
    },

    /**
     * Method called when a page workzer has been executed
     * 
     * @param  {Object} response JSON response sent from the worker. Look at ScriptModifier.js
     *                           for details on the format
     * @return {void}         
     */
    handleFuzzingWorkerResponse: function(response){

        if (this.toSendToDetection.findIndex(function(elem){
                return elem.uuid === response.payload.uuid;
            }) === -1){

            var elemIndex = this.currentBatch.findIndex(function(elem){
                return elem.uuid === response.payload.uuid;
            });

            args = this.currentBatch[elemIndex].args;

            this.toSendToDetection.push(
            {
                "uuid": response.payload.uuid,
                "args": args ? args : undefined,
                "response": {
                    "HTML": response.payload.returnedHTML,
                    "context": response.payload.returnedContext,
                    "callStack": response.payload.returnedCallstack,
                    "value": response.payload.returnedValue ? response.payload.returnedValue : undefined,
                    "error": response.payload.error
                }
            });

            if (FBTrace.DBG_FIRESTORM && DBG_DISPATCHER)
                FBTrace.sysout("fireStorm; Dispatcher.handleFuzzingWorkerResponse", {
                    "toSendToDetection": this.toSendToDetection,
                    "batchFuzzingCursor": this.batchFuzzingCursor
                });

            this.batchFuzzingCursor++;

            modelHandler.updateFuzzingProgress(
                this.batchFuzzingCursor*100/(this.currentBatch.length+1)                                // We need to count the detection as one element
            );   
                                                                                                            // of the fuzzing chain
                                                                                                
            if (this.batchFuzzingCursor === this.currentBatch.length){
                
                this.previousBatch = this.currentBatch;                                                 // saving the previous batch to use as food for the brains
                this.cleanUpDispatcher(); 
                ScriptModifier.desactivate();

                this.sendFuzzingDataToDetection();
            } else{
                this.cleanUpDispatcher();
                this.fuzzBatch();
            }
        }   
    },

    /**
     * Cleans up the dispatcher, it mainly frees the memory used by the page-workers
     * 
     * @return {void}
     */
    cleanUpDispatcher: function(){
        if(this.pageworkers){
            this.pageworkers.forEach(function(worker){
                worker.destroy();
            });

            this.pageworkers = [];
        }
    },

    /**
     * Call the detection Module and sends data to it.
     * 
     * @return {void}
     */
    sendFuzzingDataToDetection: function(){
        var self = this;

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; Dispatcher.sendFuzzingDataToDetection",{
                "toSendToDetection": this.toSendToDetection
            });

        this.detectionWorker.postMessage({
                "command": "detect",
                "payld": self.toSendToDetection
        });
        self.toSendToDetection = []
    },

    /**
     * Transform the returned brain array of arguments in an array with id no that they can be
     * identified in the fuzzing chain
     * 
     * @param  {Array} dataBatch batch of generated data
     * @return {Array}           btach of objects with ids and generated data
     */
    idDataBatchElements: function(dataBatch){
        dataBatch.push(false)                                                                           // We add one extra empty element on the dataBatch that
        return dataBatch.map(function(elem){                                                            // will be responsible for triggering the retrieval of
            return {"uuid": uuidGenerator.generateUUID().number, "args":elem };                           // a situation reference for the environnment.    
        });
    },

    /**
     * Handler for all worker modules incoming messages
     * 
     * @param  {MessageEvent} e Event containing the message from the worker
     * @return {void}
     */
    workerMessageHandler: function(e){
        if (e.data.class === "intializationMark"){

            if (FBTrace.DBG_FIRESTORM)
                FBTrace.sysout("fireStorm; Dispatcher.workerMessageHandler.intializationMark",{
                    "Message": e.data
                });

            this.brainWorker.postMessage({
                command: "handleGeneration",
                payload: {
                    batchSize: this.batchSize,
                    previousBatch: this.previousBatch
                }
            });
        } else if (e.data.class === "brainModResponse"){
            
            if (FBTrace.DBG_FIRESTORM)
                FBTrace.sysout("fireStorm; Dispatcher.workerMessageHandler.brainModResponse",{
                    "Message": e.data
                });
            this.batchSize = e.data.payload.length;
            this.fuzzFunction(e.data.payload);
        } else if (e.data.class === "fuzzingInitResponse"){
            if (FBTrace.DBG_FIRESTORM)
                FBTrace.sysout("fireStorm; Dispatcher.workerMessageHandler.fuzzingInitResponse",{
                    "Message": e.data
                });
        } else if (e.data.class === "detectModResponse"){
                                                                                                        // When the detection is finished, the fuzzing
            if (FBTrace.DBG_FIRESTORM)                                                                  // results are available
                FBTrace.sysout("fireStorm; Dispatcher.workerMessageHandler.detectModResponse",{
                    "Message": e.data
                });
            modelHandler.updateFuzzingData(e.data.payload);
            modelHandler.updateFuzzingProgress(100);                

        } else if (e.data.debug && FBTrace.DBG_FIRESTORM){
            FBTrace.sysout("fireStorm;"+ e.data.payload.header,{
                "Message": e.data.payload.content
            });
        } 
    }
});

// ********************************************************************************************* //
// Registration

Firebug.registerModule(Dispatcher);

return Dispatcher;

// ********************************************************************************************* //
});