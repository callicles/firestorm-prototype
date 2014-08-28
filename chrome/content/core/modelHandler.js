/* See license.txt for terms of usage */

define([
    "firebug/lib/object",
    "firebug/lib/trace",
],
function(Obj, FBTrace) {

    const DBG_MODEL_HANDLER = false;

// ********************************************************************************************* //
// Model Handler implementation
// 
// This Module is partly inspired by the Observer pattern. In fact we can't properly use one
// in a firebug extension because the shared model betwwen all modules and panels is the context 
// and we do control its construction. This class aims at being the interface for context 
// modifications and their management. At each modification, all the model Observers' will be
// notified so that they can react accordingly.
// 
// Coould be replaced by the observer built-in service or by custom events ...

var ModelHandler = Obj.extend(Firebug.Module,
{
    panelObservers : [],                                                                               

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module Methods

    initialize: function(owner)
    {
        Firebug.Module.initialize.apply(this, arguments);

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ModelHandler.initialize");
    },

    shutdown: function()
    {
        Firebug.Module.shutdown.apply(this, arguments);

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ModelHandler.shutdown");
    },

    loadedContext: function(context)
    {
        this.context = context;
        this.panelObservers = [];
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    //  Observer Methods

    suscribePanel: function(panel)
    {
        if(FBTrace.DBG_FIRESTORM && DBG_MODEL_HANDLER)
            FBTrace.sysout("fireStorm; ModelHandler.suscribePanel",{
                "this.panelObservers": this.panelObservers,
                "panel": panel
            });

        if(this.panelObservers.indexOf(panel) == -1)
            this.panelObservers.push(panel);
    },

    unsuscribePanel: function(panel)
    {
        var index = panelObservers.indexOf(panel);
        if (index > -1)
            panelObservers.splice(index, 1);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    //  Context handling methods

    /**
     * Modifies the context variable 'Firestorm.selectedFunction' and sends a notification to all
     * the Observers.
     * 
     * @param  {FunctionLeaf} functionLeaf function Leaf selected in the firestorm panel.
     * @return {void}
     */
    updateSelectedFunction: function(functionLeaf)
    {
        if (DBG_MODEL_HANDLER && FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; ModelHandler.shutdown",functionLeaf);
        this.context.Firestorm.selectedFunction = functionLeaf;
        this.context.Firestorm.dependencies = functionLeaf.repObject.value.
            getDependencies(this.context.Firestorm.functionTree).map(function(elem){
                return {
                    functionLeaf: elem,
                    concreteArgs: []
                }
            });
        this.dispatchUpdate({update: "selectedFunction"});
    },

    /**
     * Modifies the context variable 'Firestorm.genModules' and sends a notification to all
     * the Observers.
     * 
     * @param  {Object} Object representing a generation module
     * @return {void}
     */
    updateAvailableGenModules: function(genModule)
    {

        if (!this.context.Firestorm.genModules.indexOf(genModule) != -1){
            this.context.Firestorm.genModules.push(genModule);
            this.dispatchUpdate({update: "genModules"});
        }
    },

    /**
     * Modifies the context variable 'Firestorm.detectModules' and sends a notification to all
     * the Observers.
     * 
     * @param  {Object} Object representing a detection module
     * @return {void}
     */
    updateAvailableDetectModules: function(detectModule)
    {
        if (!this.context.Firestorm.detectModules.indexOf(detectModule) != -1){
            this.context.Firestorm.detectModules.push(detectModule);
            this.dispatchUpdate({update: "detectModules"});
        }
    },

    /**
     * Modifies the context variable 'Firestorm.brainModules' and sends a notification to all
     * the Observers.
     * 
     * @param  {Object} Object representing a brain module
     * @return {void}
     */
    updateAvailableBrainModules: function(brainModule)
    {
        if (!this.context.Firestorm.brainModules.indexOf(brainModule) != -1){
            this.context.Firestorm.brainModules.push(brainModule);
            this.dispatchUpdate({update: "brainModule"});
        }
    },

    /**
     * Modifies the context variable 'Firestorm.seletecModules' and sends a notification to all
     * the Observers.
     * 
     * @param  {Object} Object representing selected modules as :
     *     {
     *         generators: [<generatorId1>, ...],
     *         brain: undefined,
     *         detector: <detectorId> 
     *     }
     * @return {void}
     */
    updateSelectedModules: function(modules)
    {
        this.context.Firestorm.selectedModules = modules;
        this.dispatchUpdate({"update": "selectedModules"});
    },

    /**
     * Method to update the progress of the fuzzing in the context
     * 
     * @param  {Integer} progress fuzzing progress in percent
     * @return {void}          
     */
    updateFuzzingProgress: function(progress)
    {
        this.context.Firestorm.fuzzingProgress = progress;
        if(progress === 100)
            this.dispatchUpdate({update: "fuzzingFinished"});
        else
            this.dispatchUpdate({update: "fuzzingInProgress", "progress": progress})
    },

    /**
     * Method to update the model with the fuzzed data. However, we do not dispatch an update as this
     * 'event' is equivalent to the end of the fuzzing which is handled by the 'updateFuzzingProgress'
     * method
     * 
     * @param  {Array} fuzzingData Data retrieved from the detection module
     * @return {void}            
     */
    updateFuzzingData: function(fuzzingData)
    {
        this.context.Firestorm.fuzzingData = fuzzingData;
    },

    /**
     * Method that sends update notifications to all the observers.
     * 
     * @param  {Object} message containing the changed context object
     * @return {void}        
     */
    dispatchUpdate:function(message){
        if(FBTrace.DBG_FIRESTORM && DBG_MODEL_HANDLER)
            FBTrace.sysout("fireStorm; ModelHandler.dispatchUpdate",{
                panelObservers:this.panelObservers
            });
        for(var observer of this.panelObservers){
            observer.updateNotification(message);
        };
    }
});

// ********************************************************************************************* //
// Registration

Firebug.registerModule(ModelHandler);

return ModelHandler;

// ********************************************************************************************* //
});
