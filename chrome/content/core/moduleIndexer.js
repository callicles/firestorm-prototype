/* See license.txt for terms of usage */

Components.utils.import("resource://gre/modules/FileUtils.jsm");                                        // Loads IO librairy
Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firestorm/lib/utils",
    "firestorm/core/modelHandler"
],
function(Obj, FBTrace, Utils, ModelHandler ) {

// ********************************************************************************************* //
// Module Indexer
// 
// This module indexes all the generation and detection modules and send registers them into
// the page context.

var moduleIndexer = Obj.extend(Firebug.Module,
{

    firestormNSI: null,
    workerModuleList: [],

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Intitialize Methods

    initialize: function(owner)
    {
        Firebug.Module.initialize.apply(this, arguments);

        function getAddOnPath(self,fn){                                                                 // Litle routine to get the addOn path
            AddonManager.getAllAddons(function(addons) {
                fn(self, addons.filter(function(addon){
                    return addon.name == "Fire Storm";
                })[0].getResourceURI().spec);
            });
        }

        getAddOnPath(this, function(self,path){
            self.firestormNSI = path;
        });

        if (FBTrace.DBG_FIRESTORM_INDEXER)
            FBTrace.sysout("fireStorm; moduleIndexer.initialize",{
                "fireStormPath" :this.firestormNSI
            });
    },

    shutdown: function()
    {
        Firebug.Module.shutdown.apply(this, arguments);

        if (FBTrace.DBG_FIRESTORM_INDEXER)
            FBTrace.sysout("fireStorm; moduleIndexer.shutdown");
    },

    loadedContext: function(context)
    {

        if (FBTrace.DBG_FIRESTORM_INDEXER)
            FBTrace.sysout("fireStorm; moduleIndexer.loadedContext", {
                path: this.firestormNSI
            });
        if (!context.Firestorm.genModules){
            context.Firestorm.genModules = [];
            context.Firestorm.detectModules = [];
            context.Firestorm.brainModules = [];
        }

        Utils.setTimeout.call(this, this.startIndex, 500);

    },

     // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Indexing Methods

    /**
     * This method launches index procedure for generation module and detection module
     * 
     * @return {void}
     */
    startIndex: function(){

        this.indexModules({
            moduleType: "generation",
            suffix: "GenModule",
            workerType: "generator"
        });
        this.indexModules({
            moduleType: "detection",
            suffix: "DetecModule",
            workerType: "detector"
        });
        this.indexModules({
            moduleType: "brains",
            suffix: "BrainModule",
            workerType: "brainer"
        });
    },

    /**
     * This method checks the files corresponding to the specified module types in order to find modules
     * . Then creates worker of the seemly corresponding module files and send them an integrity check
     * request.
     * 
     * @param  {Object} moduleCaract This is a standardised object that gives caracteristics on the
     *                               module to index. It Has the following layout:
     *                               {
     *                                   moduleType: <moduleTypeFolder>,
     *                                   suffix: <fileSuffix>,
     *                                   workerType: <checkerRecognitionString>
     *                               }
     *                               we could have used the same for the three of them but it could have
     *                               been misleading.
     * @return {void}
     */
    indexModules: function(moduleCaract){
        var moduleList = [];

        var IOService = Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService);

        var nsIURI = IOService.newURI(
                this.firestormNSI+"/chrome/content/"+moduleCaract.moduleType, 
                null, 
                null
            );

        var folder = nsIURI.QueryInterface(Components.interfaces.nsIFileURL).file;
        
        if (FBTrace.DBG_FIRESTORM_INDEXER)
            FBTrace.sysout("fireStorm; moduleIndexer.indexModules",{
                "moduleCaract": moduleCaract,
                "firestormpath": this.firestormNSI,
                "folder":folder
            });

        if (folder.isDirectory()){
            var fileList = folder.directoryEntries;

            while(fileList.hasMoreElements()){
                var entry = fileList.getNext();
                entry.QueryInterface(Components.interfaces.nsIFile)
                var fileName = entry.leafName;

                if (fileName.contains(moduleCaract.suffix) && 
                        !this.workerModuleList.some(
                            function(elem, index, array){
                                return elem.name === this;
                            },
                            fileName
                        )
                    ){
                    var module = {
                        workerType: moduleCaract.workerType, 
                        name: fileName,
                        worker: new Worker("chrome://firestorm/content/"+moduleCaract.moduleType+'/'+fileName)
                    };
                    this.workerModuleList.push(module);
                    this.checkModule(module);
                }
            }
        }
    },

    /**
     * This methode creates the event handlers for the concerned worker and sends the integrity check
     * Message
     * 
     * @param  {Object} module Object representing a module in the workerModuleList. The layout should
     *                         be the following:
     *                             {
     *                                 workerType: <checkerRecognitionString>,
     *                                 name: <fileName>,
     *                                 worker: <referenceToTheWorker>   
     *                             }
     * @return {void}
     */
    checkModule: function(module){

        var self = this;
        module.worker.onmessage = function(e){
            self.workerMessageHandler.call(self,e);
        };

        module.worker.onerror = function (event){
            FBTrace.sysout("fireStorm; moduleIndexer.checkModule.ERROR",{
                "event": event
            });
        };

        module.worker.postMessage({
                command: "checkIntegrity",
                payld: module.name
        });
    },

    /**
     * Checks the received check argument for module validity and registers the module if necessary.
     * It also cleans the worker and the list of the module currently checked.
     * 
     * @param  {Object}     payload     Payload received from the module object, contains the checker
     *                                  object and the object displayable caracteristics.
     * @param  {Integer}    moduleIndex Index of the checked module in the workerModuleList
     * @return {void}          
     */
    isValidModule: function(payload, moduleIndex){

        var worker = this.workerModuleList[moduleIndex].worker,
            check = payload.check,
            toIndex = {
                moduleFile: this.workerModuleList[moduleIndex].name,
                toDisplay: payload.caract
            };


        if (check){
            for (var property in check){
                if (!check[property]){
                    worker.terminate();
                    this.workerModuleList.splice(moduleIndex,1);
                    return;
                }
            }

            if (this.workerModuleList[moduleIndex].workerType === "generator")
                ModelHandler.updateAvailableGenModules(toIndex);
            else if (this.workerModuleList[moduleIndex].workerType === "detector")
                ModelHandler.updateAvailableDetectModules(toIndex);
            else if (this.workerModuleList[moduleIndex].workerType === "brainer")
                ModelHandler.updateAvailableBrainModules(toIndex);
        }

        worker.terminate();
        this.workerModuleList.splice(moduleIndex,1);

    },

    /**
     * This method handles incoming messages from the built workers.
     * 
     * @param  {Event} event object containing the message data
     * @return {void}      
     */
    workerMessageHandler: function(event){

        if (FBTrace.DBG_FIRESTORM && event.data.debug)
            FBTrace.sysout(event.data.payload.header, {
                "Message content": event.data.payload.content
            });

        if (event.data.class == "integrityCheck"){

            var moduleIndex = this.workerModuleList.findIndex(function(elem, index, array){
                return elem.name == event.data.payload.fileName;
            })
            
            if (FBTrace.DBG_FIRESTORM_INDEXER && event.data.debug)
            FBTrace.sysout("fireStorm; moduleIndexer.checkMessage workerMessageHandler",{
                "index": moduleIndex,
                "module list": this.workerModuleList,
                "eventdata": event.data
            });
    
            this.isValidModule(event.data.payload, moduleIndex)
        }
    }

});

// ********************************************************************************************* //
// Registration

Firebug.registerModule(moduleIndexer);

return moduleIndexer;

// ********************************************************************************************* //
});
