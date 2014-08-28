/* See license.txt for terms of usage */

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firebug/lib/dom",
    "firebug/lib/css",
    "firebug/lib/domplate",
    "firebug/lib/locale",
    "firestorm/core/modelHandler",
    "firestorm/core/dispatcher"
],
function(Obj, FBTrace, Dom, Css, Domplate, Locale, ModelHandler, Dispatcher) {


    const contentPath = "chrome://firestorm/content/";
    const DBG_SIDE_PANEL = true;

// ********************************************************************************************* //
// Panel Implementation

Firebug.FuzzingSidePanel = function FuzzingSidePanel() {};
Firebug.FuzzingSidePanel.prototype = Obj.extend(Firebug.Panel,
{
    name: "FuzzingSidePanel",
    title: "Fuzzer",

    /**
     * This panel is automatically used as a side-panel when parent panel is set.
     */
    parentPanel: "FireStormPanel",

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Initialization

    initialize: function()
    {

        Firebug.Panel.initialize.apply(this, arguments);
        ModelHandler.suscribePanel(this);
        var firestorm = Firebug.currentContext.Firestorm;
        this.Fuzzer.render(
            firestorm.selectedFunction, 
            this.panelNode, 
            firestorm.genModules.length == 0 ? 
                [{
                    toDisplay: {
                        name: "Generation Modules not Found", 
                        description: "Check your modules"
                    }
                }] : firestorm.genModules,
            firestorm.detectModules.length == 0 ? 
                [{
                    toDisplay: {
                        name: "Detection Modules not Found", 
                        description: "Check your modules"
                    }
                }] : firestorm.detectModules,
                firestorm.dependencies
        );

    },

    destroy: function(state)
    {
        Firebug.Panel.destroy.apply(this, arguments);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Model Change
    //
    
    /**
     * Method called when the context is modified through the modelHandler module
     * 
     * @param  {Object} message message describing the modification
     * @return {void}  
     */
    updateNotification: function(message)
    {
        if (FBTrace.DBG_FIRESTORM && DBG_SIDE_PANEL)
            FBTrace.sysout("fireStorm; FuzzingSidePanel.updateNotification",{
                message: message
            });
        if (message.update === "selectedFunction" ||
            message.update === "genModules" ||
            message.update === "detectModules"){
            this.refresh();
        }
    },

    /**
     * Refreshes the fuzzing panel
     * 
     * @return {void} 
     */
    refresh: function()
    {
        var fireStorm = Firebug.currentContext.Firestorm,
            functionLeaf = fireStorm.selectedFunction.repObject.value,
            panel = Firebug.chrome.getPanelDocument(Firebug.getPanelType("FuzzingSidePanel")),
            args = functionLeaf.args,
            dependencies = fireStorm.dependencies;

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FuzzingSidePanel.refresh",{
                functionLeaf: functionLeaf,
                Firebug: Firebug,
                elemnt: panel.getElementById("selectedFunctionName"),
                dependencies: dependencies
            });

        panel.getElementById("selectedFunctionName").innerHTML =
            functionLeaf.getName()+'('+args.join(',')+')';


        panel.getElementById("dependencies").innerHTML = "";

        if (dependencies.length > 0)
            this.Fuzzer.dependencies.append(
                {
                    "dependencies": dependencies.map(function(elem){
                        return {
                            functionName: elem.functionLeaf.getName(),
                            args: elem.functionLeaf.args,
                            argConcat: elem.functionLeaf.args.join(',')
                        }
                    })
                },
                panel.getElementById("dependencies")
            );

        panel.getElementById("generationBlock").innerHTML = "";

        for (var arg of args){
            this.Fuzzer.appendGenModule(arg, fireStorm.genModules, panel.getElementById("generationBlock"));
        }

        if (args.length === 0)
            this.Fuzzer.appendGenModule("-", fireStorm.genModules, panel.getElementById("generationBlock"));
    },

});



// ********************************************************************************************* //
// Template
// 
Firebug.registerStringBundle("chrome://FireStorm/locale/firestorm.properties");
/**
 * Domplate template used to render panel's content. Note that the template uses
 * localized strings and so, Firebug.registerStringBundle for the appropriate
 * locale file must be already executed at this moment.
 */
with (Domplate) {
    Firebug.FuzzingSidePanel.prototype.Fuzzer = domplate(
    {
        tag:
            DIV(
                {
                    class: "container-fluid"
                },
                DIV(
                    {
                        class: "row"
                    },
                        DIV(
                        {
                            class: "col-xs-12"
                        },
                        FORM(
                            {
                                role: "form",
                                class:"fuzzingForm"
                            },
                            DIV(
                                {
                                    class: "form-group"
                                },
                                LABEL({},Locale.$STR("firestorm.fuzzerSidePanel.selectedFunction")),
                                DIV(
                                    {
                                        id:"selectedFunctionName",
                                        class:"well well-sm form-control"
                                    },
                                    "$functionLeaf.name"+'('+"$functionLeaf.concatArgs"+')'
                                )
                            ),
                            DIV(
                                {
                                    id: "dependencies"
                                }
                            ),
                            DIV({},                                
                                H3(
                                    {},
                                    Locale.$STR("firestorm.fuzzerSidePanel.generation"),
                                    A(
                                        {
                                            class: "ArgBtn btn",
                                            onclick:"$onDeleteGenericArgumentGenerationModule"
                                        },
                                        "-"
                                    ),
                                    A(
                                        {
                                            class: "ArgBtn btn",
                                            onclick:"$onAddGenericArgumentGenerationModule"
                                        },
                                        "+"
                                    )
                                ),
                                DIV(
                                    {
                                        id:"generationBlock"
                                    },
                                    FOR("arg","$functionLeaf.args",
                                        TAG("$argumentGenerationModule",
                                            {
                                                arg: "$arg",
                                                genModules: "$genModules"
                                            }
                                        )
                                    )
                                )
                            ),
                            TAG("$functionDetectionModule", {detectModules: "$detectModules"}),
                            A(
                                {
                                    type: "button",
                                    class: "fuzzBtn btn",
                                    onclick:"$onFuzz" 
                                },
                                "Fuzz !"
                            )
                        )
                    )
                )
            ),

        argumentGenerationModule:
            DIV({
                    class: "form-group generationModule"
                },
                LABEL(
                    {
                        for: "",
                        class: "generation"
                    },
                    Locale.$STR("firestorm.fuzzerSidePanel.generationModule")+" "+"$arg : "
                ),
                SELECT(
                    {
                        class: "form-control generationSelector"
                    },
                    FOR("genModule","$genModules",
                        OPTION(
                            {
                                id: "$genModule.moduleFile",
                                title: "$genModule.toDisplay.description"
                            },
                            "$genModule.toDisplay.name"
                        )
                    )
                )
            ),

        functionDetectionModule:
            DIV({
                    class: "form-group"
                },
                H3(
                    {
                        for: ""
                    },
                    Locale.$STR("firestorm.fuzzerSidePanel.detectionModule")
                ),
                SELECT(
                    {
                        class: "form-control",
                        id: "detectionSelector"
                    },
                    FOR("detectModule","$detectModules",
                        OPTION(
                            {
                                id: "$detectModule.moduleFile",
                                title: "$detectModule.toDisplay.description"
                            },
                            "$detectModule.toDisplay.name"
                        )
                    )
                )
            ),

        dependencies:
        DIV({},
            H3(
                {},
                Locale.$STR("firestorm.fuzzerSidePanel.dependencies")
            ),
            FOR("dep", "$dependencies",
                DIV(
                    {
                        class: "form-group function"
                    },
                    LABEL(
                        {
                            class:"dependency",
                            for: ""
                        },
                        "$dep.functionName"+'('+"$dep.argConcat"+')'
                    ),
                    FOR("arg", "$dep.args",
                        INPUT(
                            {
                                class: "form-control argument",
                                type: "text",
                                placeholder: Locale.$STR("firestorm.fuzzerSidePanel.inputDep")+" "+"$arg",
                                id: "$dep.functionName"+'-'+"$arg"
                            }
                        )
                    )
                )
            )
        ),

        /**
         * Adds a generation module to the list module
         * 
         * @param  {Event} event Click event
         * @return {void} 
         */
        onAddGenericArgumentGenerationModule: function(event){

            if (event.button != 0)
                return;

            var panel = Firebug.chrome.getPanelDocument(Firebug.getPanelType("FuzzingSidePanel"));

            var genBlock = panel.getElementById("generationBlock");

            if (FBTrace.DBG_FIRESTORM)
                FBTrace.sysout("fireStorm; FuzzingSidePanel.onAddGenericArgumentGenerationModule",{
                    panel: panel,
                    genBlock: genBlock
                });
            if (Firebug.currentContext.Firestorm.selectedFunction.repObject.value.args.length >
                genBlock.children.length)
                this.appendGenModule(
                    Firebug.currentContext.Firestorm.selectedFunction.
                        repObject.value.args[genBlock.children.length],
                    Firebug.currentContext.Firestorm.genModules,
                    genBlock
                );
            else
                this.appendGenModule("-", Firebug.currentContext.Firestorm.genModules,genBlock);
        },

        /**
         * Deletes the last added generation module
         * 
         * @param  {Event} event Click event
         * @return {void}     
         */
        onDeleteGenericArgumentGenerationModule: function(event){

            if (event.button != 0)
                return;

            var panel = Firebug.chrome.getPanelDocument(Firebug.getPanelType("FuzzingSidePanel"));

            var genBlocks = panel.getElementById("generationBlock").children

            if (genBlocks.length > 1)
                genBlocks[genBlocks.length-1].remove();
        },

        /**
         * Deletes the last added generation module
         * 
         * @param  {Event} event Click event
         * @return {void}     
         */
        onFuzz: function(event){

            if (event.button != 0)
                return;

            var panel = Firebug.chrome.getPanelDocument(Firebug.getPanelType("FuzzingSidePanel"));
            var args = Firebug.currentContext.Firestorm.selectedFunction.repObject.value.args;

            var genModuleMap = {};
            var genSelectorList = panel.getElementsByClassName("generationSelector");
            for (var i = 0 ; i < genSelectorList.length ; i++){
                if (args[i])
                    genModuleMap[''+args[i]] = contentPath+"generation/"+
                        genSelectorList[i][genSelectorList[i].selectedIndex].id;
                else
                    genModuleMap[''+i] = contentPath+"generation/"+
                        genSelectorList[i][genSelectorList[i].selectedIndex].id;
            }

            var detectSelector = panel.getElementById("detectionSelector"),
                HTMLDepfunctions = panel.getElementsByClassName("function"),
                depFunctionsArgs = [];

            for (var i = 0 ; i < HTMLDepfunctions.length ; i++){
                var HTMLArgs = HTMLDepfunctions[i].getElementsByClassName("argument");
                var args = [];

                for (var j = 0 ; j < HTMLArgs.length ; j++){
                    args.push(HTMLArgs[j].value);
                }
                depFunctionsArgs.push(args);

            }

            if (FBTrace.DBG_FIRESTORM && DBG_SIDE_PANEL)
                FBTrace.sysout("fireStorm; FuzzingSidePanel.onFuzz",{
                    depFunctionsArgs: depFunctionsArgs
                });

            ModelHandler.updateSelectedModules(
                {
                    generators: genModuleMap,
                    brain: undefined,
                    detector: detectSelector[detectSelector.selectedIndex].id
                }
            );

            Dispatcher.dispatch(
                genModuleMap,
                detectSelector[detectSelector.selectedIndex].id, 
                undefined,                                                                              // For now we don't use brain modules, just use the default
                Firebug.getPref("extensions.firebug","firestorm.generationDefaultDataBatchSize"),
                depFunctionsArgs                                                                        // one. As for the batch size, It is hardcoded for now but it
            )                                                                                           // should be set in the preference file. Once the brain will
        },                                                                                              // be in place they will control that parameter.

        /**
         * Initialy renders the whole panel
         * 
         * @param  {functionLeafRow}    functionLeaf    HTML element representing a function leaf
         * @param  {Node}               parentNode      Node to add the view into
         * @param  {Array}              genModules      List of all the generation modules available
         * @param  {Array}              detectModules   List of all the detection modules available   
         * @param  {Array}              dependencies    List of the function dependencies as functions.
         *                                      It is of the form:
         *                                      [
         *                                          <functionLeaf1>,
         *                                          <functionLeaf2>,
         *                                                 .
         *                                                 .
         *                                                 .
         *                                      ]   
         * @return {void}  
         */
        render: function(functionLeaf, parentNode, genModules, detectModules, dependencies)
        {
            this.tag.replace(
                {
                    "functionLeaf":
                        {
                            "name": functionLeaf.repObject.value.getName(),
                            "args": functionLeaf.repObject.value.args,
                            "concatArgs": functionLeaf.repObject.value.args.join(',')
                        },
                    "genModules": genModules,
                    "detectModules": detectModules,
                }, 
                parentNode
            );
            if (dependencies.length > 0)
                this.dependencies.append(
                    {
                        "dependencies": dependencies.map(function(elem){
                            return {
                                functionName: elem.functionLeaf.getName(),
                                args: elem.functionLeaf.args,
                                argConcat: elem.functionLeaf.args.join(',')
                            }
                        })
                    },
                    Firebug.chrome.getPanelDocument(Firebug.getPanelType("FuzzingSidePanel"))
                        .getElementById("dependencies")
                );
        },

        /**
         * Adds a generation module at the end of the generation module list
         * 
         * @param  {String}     arg             String of the argument assigned to the module
         * @param  {Array}      genModules      List of the genration module to display
         * @param  {Node}       parentNode      Node to add the view into   
         * @return {void}  
         */
        appendGenModule: function(arg, genModules, parentNode){
            this.argumentGenerationModule.append(
                {
                    "arg":arg,
                    "genModules":genModules
                }, 
                parentNode
            );
        }
    })
}

// ********************************************************************************************* //

return Firebug.FuzzingSidePanel;

// ********************************************************************************************* //
});