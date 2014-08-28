/* See license.txt for terms of usage */

define([
    "firebug/lib/dom",
    "firebug/lib/css",
    "firebug/lib/object",
    "firebug/lib/trace",
    "firebug/lib/locale",
    "firebug/lib/search",
    "firebug/lib/domplate",
    "firebug/lib/xpcom",
    "firebug/html/htmlLib",
    "firebug/chrome/searchBox",
    "firestorm/lib/utils",
    "firestorm/lib/tablesort",
    "firestorm/core/scriptanalyser",
    "firestorm/core/moduleIndexer",
    "firestorm/core/modelHandler",
    "firestorm/fuzzingSidePanel"

],
function(Dom, Css, Obj, FBTrace, Locale, Search, Domplate, Xpcom, HTMLLib, SearchBox, Utils, TableSort,
    ScriptAnalyser, ModuleIndexer, ModelHandler, FuzzingSidePanel) {

// ********************************************************************************************* //
// Script Panel Implementation

const panelName = "FireStormPanel";
const DBG_FIRESTORMPANEL = true;

Firebug.FireStormPanel = function FireStormPanel() {};
Firebug.FireStormPanel.prototype = Obj.extend(Firebug.Panel,
{
    name: panelName,
    title: "FireStorm",
    searchable: true,
    objectPathAsyncUpdate: true,

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Initialization

    initialize: function()
    {

        // Panel initialization (there is one panel instance per browser tab)
        Firebug.Panel.initialize.apply(this, arguments);

        var page = this.context.window.document;

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStormPanel.initialize", {
                "this": this,
                "context": this.context,
                "Current Page": page          
            });

        ModelHandler.suscribePanel(this);

        this.refresh();
    },

    destroy: function(state)
    {
        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStormPanel.destroy");

        Firebug.Panel.destroy.apply(this, arguments);
    },

    show: function(state)
    {
        Firebug.Panel.show.apply(this, arguments);        

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStormPanel.show",{
                "state": state
            });
    },

    refresh: function()
    {
        // Render panel content. The HTML result of the template corresponds to: 
        //this.panelNode.innerHTML = "<span>" + Locale.$STR("hellobootamd.panel.label") + "</span>";
        this.Welcome.render(this.panelNode);

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStormPanel.refresh", this);
    },

    shutdown: function()
    {
        Firebug.unregisterModule(ScriptAnalyser);
        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStorm Panel shutdown");
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Toolbar

    /**
     * Extends toolbar for this panel.
     */
    getPanelToolbarButtons: function()
    {
        var buttons = [];

        if (FBTrace.DBG_FIRESTORM)
            buttons.push({
                label: "firestorm.toolbar.button.label",
                tooltiptext: "firestorm.toolbar.button.tooltip",
                command: FBL.bindFixed(this.onHello, this)
            });

        buttons.push({
            type: "menu",
            label: "firestorm.toolbar.scripts.label",
            tooltiptext: this.getScriptMenuToolTipText(),
            items: this.getMenuButtonItems(),
            disabled: !this.hasScripts()
        });

        buttons.push({
            id: "toggleFuzzingSidePanelButton",
            label: "Fuzzer",
            tooltiptext: "firestorm.toolbar.fuzzer.tooltip",
            command: FBL.bindFixed(this.ToogleSidePanel, this),
            disabled: this.isSelectedFunction()
        });

        buttons.push({
            label: "firestorm.toolbar.indexer.label",
            tooltiptext: "firestorm.toolbar.indexer.tooltip",
            command: FBL.bindFixed(ModuleIndexer.startIndex, ModuleIndexer)
        });

        return buttons;
    },

    /**
     * Generates the script list of the current web page
     * 
     * @return {Array} List of all the scripts as buttons
     */
    getMenuButtonItems: function()
    {
        var items = [];

        if (!this.hasScripts())
            items.push({
                label: "firestorm.toolbar.scripts.noScript"
            }); 

        var scripts = Utils.mapToList(this.context.sourceFileMap);

        for (var i = 0; i < scripts.length ; i++){
            items.push({
                nol10n: true,
                label: Utils.getFileName(scripts[i].href),
                command: FBL.bindFixed(this.onScriptSelection, this, scripts, i)
            }); 
        }

        return items;
    },

    /**
     * Checks wether or not a function is selected
     * 
     * @return {Boolean}
     */
    isSelectedFunction: function(){
        return this.context.Firestorm.selectedFunction ? false : true;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Search
    // 
    
    /**
     * Search Functionnality, greatly inspired from the DOM panel search method
     * 
     * @param  {String}     text    text to search from
     * @param  {boolean}    reverse Indicates, if search is reversed
     * @return {boolean}             True if search returned result, false otherwise
     */
    search: function(text, reverse){
        if (!text) {
            delete this.currentSearch;
            this.highlightNode(null);
            this.document.defaultView.getSelection().removeAllRanges();
            return false;
        }

        var row;
        if (this.currentSearch && text === this.currentSearch.text){
            row = this.currentSearch.findNext(true, undefined, reverse,
                SearchBox.isCaseSensitive(text));
        }
        else {
            var findRow = function(node)
            {
                return Dom.getAncestorByClass(node, "searchableRow");
            };

            this.currentSearch = new Search.TextSearch(this.panelNode, findRow);

            row = this.currentSearch.find(text, reverse, SearchBox.isCaseSensitive(text));
        }

        if (row) {
            var sel = this.document.defaultView.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.currentSearch.range);

            Dom.scrollIntoCenterView(row, this.panelNode);

            this.highlightNode(row);
            return true;
        }
        else {
            this.document.defaultView.getSelection().removeAllRanges();
            return false;
        }
    },


    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // SidePanel

    /**
     * Open and close side panel
     */
    ToogleSidePanel: function()
    {
        var registered = Firebug.getPanelType("FuzzingSidePanel");

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStormPanel.ToogleSidePanel",{
                "registered": registered
            });

        if (!registered)
            this.onAppendFuzzingSidePanel();
        else
            this.onRemoveFuzzingSidePanel();
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Options Menu

    getOptionsMenuItems: function()
    {
        return [];
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Context Menu

    /**
     * Right Click menu configuration
     * 
     * @param  {Object} object clicked target object
     * @param  {Object} target clicked target Object
     * @return {Array}         List of all the context menu options
     */
    getContextMenuItems: function(object, target)
    {

        var items = [];

        if(object && this.context.Firestorm.functionTree.hasChildren())
            items.push({
                label: "firestorm.contextMenu.showSource",
                command: FBL.bindFixed(this.showSource, this, object.value)
            });

        return items;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Commands

    /**
     * Debug method to show current context
     * 
     * @return {void} 
     */
    onHello: function()
    {
        if (FBTrace.DBG_FIRESTORM)
        FBTrace.sysout("fireStorm; FireStormPanel.onHello",{
            "Context": this.context
        });
    },

    /**
     * Method called when a script is selected in the script list. It calls the analyser
     * 
     * @param  {Array}      Scripts Script List
     * @param  {Integer}    i       Index of the selected script
     * @return {void}  
     */
    onScriptSelection: function(Scripts, i)
    {
        this.context.Firestorm.Analysisfinished = false;
        ScriptAnalyser.populateAnalysisStack(Scripts, i);
        this.Analysing.render(this.panelNode);

        this.context.Firestorm.checkProgressIntervalId = 
            Utils.setInterval.call(this, this.checkProgress, 500);

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStormPanel.onScriptSelection",{
                "Scripts": Scripts,
                "Context": this.context,
                "i":i
            });
    },

    /**
     * Called to fold the side panel
     * 
     * @return {void} 
     */
    onRemoveFuzzingSidePanel: function()
    {
        Firebug.unregisterPanel(FuzzingSidePanel);
    },

    /**
     * Called to show the side Panel
     * 
     * @return {void} 
     */
    onAppendFuzzingSidePanel: function()
    {
        Firebug.registerPanel(FuzzingSidePanel);
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Utils
    // 
    
    /**
     * Called to open the script panel and get to the source location of the selected function.
     * Called from the context menu
     * 
     * @param  {functionLeaf} functionLeaf Right clicked function leaf.
     * @return {void}              
     */
    showSource: function(functionLeaf)
    {

        Firebug.chrome.selectPanel("script");

        var scriptPanel = Firebug.chrome.getSelectedPanel(),
            compil =this.getCompilationUnit(functionLeaf) ;

        scriptPanel.updateSelection(compil);
        scriptPanel.scrollToLine(functionLeaf.range.startLine, {highlight: true});

        if (FBTrace.DBG_FIRESTORM)
        FBTrace.sysout("fireStorm; FireStormPanel.showSource",{
            "this":this,
            "Firebug": Firebug,
            "functionLeaf":functionLeaf,
            "compil":compil
        });

    },

    /**
     * Retrives the Script of the selected function leaf as a compilationUnit
     * 
     * @param  {FunctionLeaf}       functionLeaf Selected function
     * @return {CompilationUnit}                 Compilation Unit of teh selected function
     */
    getCompilationUnit: function(functionLeaf)
    {
        var locationList = Utils.mapToList(this.context.compilationUnits),
            compilationUnitName = "";

        compilationUnitName = functionLeaf.path[0].substring(1);
        compilationUnitName = compilationUnitName.substring(0,compilationUnitName.indexOf('/'));

        for (var i = 0; i< locationList.length ; i++){

            if(Utils.getFileName(locationList[i].href) === compilationUnitName)
                return locationList[i];
        }
    },

    /**
     * Checks if the current page includes scripts
     * 
     * @return {Boolean}
     */
    hasScripts: function()
    {
        return Utils.mapToList(this.context.sourceFileMap).length > 0;
    },

    /**
     * Retrieves the tooltip Script menu text
     * 
     * @return {String}
     */
    getScriptMenuToolTipText: function()
    {
        if(this.hasScripts())
            return "firestorm.toolbar.scripts.tooltip";
        return "firestorm.toolbar.scripts.noScript";
    },

    /**
     * Checks the progress made in the analysis
     * 
     * @return {void}
     */
    checkProgress: function() {

        if (this.context.Firestorm.Analysisfinished){
            this.FunctionTree.render(this.context.Firestorm.functionTree,this.panelNode);
            clearInterval(this.context.Firestorm.checkProgressIntervalId)
        }

        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStormPanel.checkProgress",{
                "analysisStack": this.context.Firestorm.analysisStack,
        });
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
        if (message.update === "selectedFunction"){

            if(Firebug.currentContext.Firestorm.selectedFunction)
                Firebug.chrome.$("toggleFuzzingSidePanelButton").setAttribute("disabled", "false");

        } else if (message.update === "fuzzingInProgress"){

            var panel = Firebug.getPanelType("FuzzingSidePanel");
            if (panel)
                this.onRemoveFuzzingSidePanel();

            Firebug.chrome.$("toggleFuzzingSidePanelButton").setAttribute("disabled", "true");

            this.Fuzzing.render(this.panelNode, message.progress);

        } else if (message.update === "fuzzingFinished") {

            if (FBTrace.DBG_FIRESTORM)
                FBTrace.sysout("fireStorm; FireStormPanel.updateNotification.fuzzingFinished",{
                    "this": this,
                    "functionLeaf": this.context.Firestorm.selectedFunction.repObject.value,
                    "resultData": this.context.Firestorm.fuzzingData
                });

            this.FuzzingResults.render(
                this.panelNode,
                this.context.Firestorm.selectedFunction.repObject.value,
                this.context.Firestorm.fuzzingData
            );
        }
    }
});

// ********************************************************************************************* //
// Panel UI (Domplate)

// Register locales before the following template definition.
Firebug.registerStringBundle("chrome://FireStorm/locale/firestorm.properties");

/**
 * Domplate template used to render panel's content. Note that the template uses
 * localized strings and so, Firebug.registerStringBundle for the appropriate
 * locale file must be already executed at this moment.
 */
with (Domplate) {
    Firebug.FireStormPanel.prototype.Welcome = domplate(
    {
        tag:
            DIV({
                    class: "center"
                },
                H1(Locale.$STR("firestorm.panel.label")),
                BR(),
                SPAN(Locale.$STR("firestorm.panel.subtitle"))
            ),

        render: function(parentNode)
        {
            this.tag.replace({}, parentNode);
        }
    }),

    Firebug.FireStormPanel.prototype.Analysing = domplate(
    {
        tag:
            DIV({
                    class: "center"
                },
                IMG({
                    src: "chrome://FireStorm/skin/images/loader.gif",
                    alt: "Analysing"
                }),
                BR(),
                SPAN(Locale.$STR("firestorm.panel.analyzing"))
            ),

        render: function(parentNode)
        {
            this.tag.replace({}, parentNode);
        }
    }),

    Firebug.FireStormPanel.prototype.FunctionTree = domplate(
    {
        tag:
            TABLE({
                    class:"functionTreeTable",
                    onclick: "$onClick"
                },
                TBODY({
                        class:"tableRoot"
                    },
                    FOR("member", "$tree|memberIterator",
                        TAG("$row", {member: "$member"}))
                )
            ),

        row:
            TR({
                    id: "$member.id",
                    class: "treeRow searchableRow", 
                    $hasChildren: "$member.hasChildren",
                    $isUsedFunction: "$member.usedFunction",
                    _repObject: "$member", 
                    level: "$member.level"
                },
                TD({
                        style: "padding-left: $member.indent\\px"
                    },
                    DIV({
                            class: "treeLabel",
                            $isUsedFunction: "$member.usedFunction"
                        },
                        "$member.name"
                    )
                ),
                TD(
                    DIV("$member.label")
                )
            ),
        loop:
            FOR("member", "$members",
                TAG("$row", {member: "$member"})
            ),

        memberIterator: function(tree)
        {
            return this.getMembers(tree);
        },

        /**
         * Method called on a function Leaf click
         * 
         * @param  {Event} event
         * @return {void}      
         */
        onClick: function(event)
        {
            if (event.button != 0)
                return;

            var row = Dom.getAncestorByClass(event.target, "treeRow");
            var label = Dom.getAncestorByClass(event.target, "treeLabel");

            if (label && Css.hasClass(row, "hasChildren")){
                if (parseInt(row.getAttribute("level")) != 0)
                    this.selectfunctionDeclaration(row);
                this.toggleRow(row);
            } else if(Css.hasClass(event.target, "isUsedFunction")){
                this.toggleClickedFunctionDeclaration(row);
            } else {
                this.selectfunctionDeclaration(row);
            }
        },

        /**
         * Method used to select a function leaf as the current selected function and display it in
         * the user interface
         * 
         * @param  {Row}    row selected function Leaf row
         * @return {void}    
         */
        selectfunctionDeclaration: function(row)
        {
            Css.removeClass(this.selectedFunctionRow, "selected");
            this.selectedFunctionRow = row;
            Css.setClass(row,"selected");
            ModelHandler.updateSelectedFunction(row);
        },

        /**
         * Opens a row
         * 
         * @param  {Row} row row to be opened
         * @return {void}     
         */
        toggleRow: function(row)
        {
            var level = parseInt(row.getAttribute("level"));

            if (Css.hasClass(row, "opened")){
                Css.removeClass(row, "opened");

                var tbody = row.parentNode;
                for (var firstRow = row.nextSibling; firstRow ; firstRow = row.nextSibling){

                    if (parseInt(firstRow.getAttribute("level")) <= level)
                        break;
                    tbody.removeChild(firstRow);
                }
            } else {
                this.openRow(row);
            }
        },

        /**
         * Open all the rows on the path of the function declaration of the clicked used function
         * 
         * @param  {Row} row used function Row
         * @return {void}     
         */
        toggleClickedFunctionDeclaration: function(row)
        {
            var path = row.repObject.value.path.split("/"),
                currentRow = Dom.getAncestorByClass(row, "tableRoot");

            for (var j = 0 ; j<path.length ; j++){
                var toInspect = Array.prototype.slice.call(currentRow.children);
                for(var i = 0 ; i<toInspect.length ; i++){

                    if (toInspect[i].repObject &&
                        !toInspect[i].repObject.usedFunction &&
                         toInspect[i].repObject.value.getName() === path[j]){
                        
                        currentRow = toInspect[i];
                        this.openRow(currentRow);
                    }
                }
            }
            Dom.scrollTo(currentRow, Dom.getAncestorByClass("panelNode-firestorm"));
        },

        /**
         * Makes the dom changes to open a Row in the user interface
         * 
         * @param  {Row} row 
         * @return {void} 
         */
        openRow: function(row)
        {
            var level = parseInt(row.getAttribute("level"));

            if (!Css.hasClass(row, "opened")){
                Css.setClass(row, "opened");

                var repObject = row.repObject;
                if (repObject) {
                    var members = this.getMembers(repObject.value, level+1);
                    if (repObject.value.usedFunctions.length > 0){
                        this.loop.insertRows(
                            {
                                members: this.getUsedMember(repObject.value.usedFunctions, level+1)
                            },
                            row
                        );
                    }
                    if (members)
                        this.loop.insertRows({members: members}, row);
                }
            }
        },

        /**
         * Retrives all memebers of a Leaf
         * 
         * @param  {functionTree}   tree  [description]
         * @param  {Integer}        level nested Level
         * @return {Array}                List of all Tree memebers
         */
        getMembers: function(tree, level)
        {

            if (!level)
                level = 0;

            var members = [],
                children = tree.getChildren();

            for (var i = 0 ; i<children.length ; i++)
                members.push(this.createMember(children[i].getName(), children[i], level));

            return members;
        },

        /**
         * Creates a Memeber for the current leaf
         * 
         * @param  {String}         name    Name of the memeber
         * @param  {FunctionLeaf}   leaf    leaf of the member  
         * @param  {Integer}        level   nested level of the member
         * @return {Object}                 Memeber object
         */
        createMember: function(name, leaf, level)
        {  

            return {
                name: name,
                id: leaf.path,
                label: (level == 0) ? "" : "Function level "+level,
                value: leaf,
                level: level,
                indent: level*16,
                hasChildren: leaf.hasChildren(),
                usedFunction: false
            };
        },

        /**
         * Get used used functions in the current function declaration
         * 
         * @param  {Array}      usedFunctions used functions list
         * @param  {Integer}    level         nested level
         * @return {Array}                    Array of displayable used functions     
         */
        getUsedMember: function(usedFunctions, level)
        {
            var usedMembers = [];

            for (var i = 0 ; i<usedFunctions.length ; i++){
                usedMembers.push({
                    name: usedFunctions[i].name,
                    id: "",
                    label: "",
                    value: usedFunctions[i],
                    level: level,
                    indent: level*16,
                    hasChildren: false,
                    usedFunction: true,
                });
            }

            return usedMembers;
        },

        /**
         * Renders the main Panel
         * 
         * @param  {FunctionTree}   functionTree function tree to display
         * @param  {Node}           parentNode   DOm node to overide
         * @return {void}              
         */
        render: function(functionTree, parentNode)
        {
            this.tag.replace({tree: functionTree}, parentNode);
        }
    }),

    Firebug.FireStormPanel.prototype.Fuzzing = domplate(
    {
        tag:
            DIV({
                    class: "center"
                },
                IMG({
                    src: "chrome://FireStorm/skin/images/loader.gif",
                    alt: "Fuzzing"
                }),
                BR(),
                SPAN(Locale.$STR("firestorm.panel.fuzzing")),
                SPAN(Locale.$STR("firestorm.progress")+" "+"$progress %")
            ),

        render: function(parentNode, progress)
        {
            this.tag.replace({"progress": Math.round(progress)}, parentNode);
        }
    }),

    Firebug.FireStormPanel.prototype.FuzzingResults = domplate(
    {
        tag:
            DIV({
                    class: "fuzzingReport",
                    id:"fuzzingReport"
                },
                H1(
                    {
                        class: "center"
                    },
                    Locale.$STR("firestorm.panel.fuzzingResults.title")
                ),
                DIV(
                    {},
                    H2(Locale.$STR("firestorm.panel.function")+": $functionLeaf.name"+'('+"$functionLeaf.concatArgs"+')'),
                    P(Locale.$STR("frestorm.panel.fuzzingResults.numbers")+
                        ": $positiveResults / $fuzzingSessionsNumber"),
                    BR(),
                    H3(Locale.$STR("firestorm.panel.fuzzingResults.reference")),
                    TABLE({
                            class:"referenceTable",
                        },
                        TBODY({
                                class:"referenceTableRoot"
                            },
                            TR({
                                class: "rowTitles"
                            },
                                TH(
                                    Locale.$STR("firestorm.panel.fuzzingResults.HTML")
                                ),
                                TH(
                                    Locale.$STR("firestorm.panel.fuzzingResults.context")
                                )
                            ),
                            TR({
                                class: "rowElements"
                            },
                                TD(
                                    {
                                        _repObject: "$reference.response.HTML",
                                        class: "HTMLSnipet",
                                        onclick: "$HTMLClick"
                                    },
                                    "$reference.response.HTML|generateExerpt"
                                ),
                                TD(
                                    "$reference.response.context"
                                )
                            )
                        )
                    ),
                    BR(),
                    H3(Locale.$STR("firestorm.panel.fuzzingResults.Details")),
                    TABLE({
                            class:"fuzzingResultsTable table-autosort",
                            id: "fuzzingResultsTable"
                        },
                        TBODY({
                                class:"fuzzingResultsBody"
                            },
                            TR({
                                class: "rowTitles no-sort"
                            },      
                                TH({
                                    class:"no-sort"
                                },
                                    ""
                                ),

                                TH(
                                    Locale.$STR("firestorm.panel.fuzzingResults.args")
                                ),
                                TH(
                                    Locale.$STR("firestorm.panel.fuzzingResults.returnedValue")
                                ),
                                TH(
                                    Locale.$STR("firestorm.panel.fuzzingResults.HTML")
                                ),
                                TH(
                                    Locale.$STR("firestorm.panel.fuzzingResults.context")
                                ),
                                TH(
                                    Locale.$STR("firestorm.panel.fuzzingResults.callStack")
                                ),
                                TH(
                                    Locale.$STR("firestorm.panel.fuzzingResults.result")
                                )
                            ),
                            FOR("fuzzingResult", "$resultData",
                                TAG("$fuzzingSession", {fuzzingResult: "$fuzzingResult"})
                            )
                        )
                    )
                )
            ),

        fuzzingSession:
            TR({
                class: "rowElements searchableRow",
                _repObject: "$fuzzingResult"
            },
                TD(
                    {
                        class: "fs-closed",
                        onclick: "$expandRowDetails"
                    },
                    ""
                ),
                TD(
                    {},
                    "($fuzzingResult.args)"
                ),
                TD(
                    {
                        _repObject: "$fuzzingResult.response.value",
                        class: "returnedValue"
                    },
                    "$fuzzingResult.response.value"
                ),
                TD(
                    {
                        _repObject: "$fuzzingResult.response.HTML",
                        class: "HTMLSnipet",
                        onclick: "$HTMLClick"
                    },
                    "$fuzzingResult.response.HTML|generateExerpt"
                ),
                TD(
                    {
                        _repObject: "$fuzzingResult.response.context",
                        class: "ContextSnipet",
                        onclick: ""
                    },
                    "$fuzzingResult.response.context"
                ),
                TD(
                    {
                        _repObject: "$fuzzingResult.response.callStack",
                        class: "CallStackSnipet",
                        onclick: ""
                    },
                    "$fuzzingResult.response.callStack"
                ),
                TD(
                    {
                        $anomaly: "$fuzzingResult.detection.result"
                    },
                    "$fuzzingResult.detection.result"
                )
            ),

        render: function(parentNode, functionLeaf, resultData)
        {
            parentNode.innerHTML ="";

            if (FBTrace.DBG_FIRESTORM && DBG_FIRESTORMPANEL)
                FBTrace.sysout("fireStorm; fireStormPanel.render",{
                    "resultData": resultData.filter(function(element, index){
                        return element.args != undefined;
                    })
                });

            this.tag.replace(
                {
                    "functionLeaf":
                        {
                            "name": functionLeaf.getName(),
                            "args": functionLeaf.args,
                            "concatArgs": functionLeaf.args.join(',')
                        },
                    "positiveResults": resultData.reduce(function(previousValue,currentValue){
                        if (currentValue.detection.result)
                            return previousValue+1;
                        else
                            return previousValue;
                    },0),
                    "fuzzingSessionsNumber": resultData.length -1,
                    "reference": resultData.find(function(element, index){
                        return element.args == undefined;
                    }),
                    "resultData": resultData.filter(function(element, index){
                        return element.args != undefined;
                    }).map(function(element){
                        return {                                                                        // Here we manually overide all the possible undefined 
                           "uuid": element.uuid ? element.uuid : "undefined",                           // results that could alter the rendering
                           "args": element.args ? element.args : "undefined",
                           "response": {
                                "HTML": element.response.HTML ? element.response.HTML : "undefined",
                                "context": element.response.context ? 
                                    element.response.context : "undefined",
                                "callStack": element.response.callStack ? 
                                    element.response.callStack : "undefined",
                                "value": element.response.value ? element.response.value : "undefined",
                                "error": element.response.error
                           },
                           "detection": {                                                                 
                               "result": element.detection.result,                                 
                               "info": element.detection.info                                               
                           }                                                                                       
                       }
                    })
                },
                parentNode
            );
            
            new TableSort(parentNode.ownerDocument.getElementById('fuzzingResultsTable'));

        },


        /**
         * Method called when clicking on the html exerpt in the report
         * 
         * @param {Event} event Event when clicking on the html exerpt
         */
        HTMLClick: function(event){
            if (event.button != 0)
                return;

            if (FBTrace.DBG_FIRESTORM && DBG_FIRESTORMPANEL)
                FBTrace.sysout("fireStorm; fireStormPanel.HTMLClick",{
                    "event": event
                });

            Firebug.chrome.selectPanel("html");

            this.insertHTML(Firebug.chrome.getSelectedPanel(), event.target.repObject);

        },

        /**
         * Method called when asking for expanding the detail on a fuzzing session
         * 
         * @param  {Event} event Event triggered when clicking on the expanding button
         * @return {void}       
         */
        expandRowDetails: function(event){
            if (event.button != 0)
                return;

            var table = Dom.getAncestorByClass(event.target, "fuzzingResultsTable");
            var row = Dom.getAncestorByClass(event.target, "rowElements");

            if (Css.hasClass(event.target, "fs-closed")){

                //Fuzzing Info

                var infoRow = table.insertRow(row.rowIndex+1);

                var td = infoRow.insertCell(0);

                td.setAttribute("colspan","0");
                td.setAttribute("style", "padding-left: 15px;");
                td.appendChild(document.createTextNode(row.repObject.detection.info))

                //Fuzzing errors
                if (row.repObject.response.error){
                    var errorRow = table.insertRow(row.rowIndex+2);

                    var td = errorRow.insertCell(0);

                    td.setAttribute("colspan","0");
                    td.setAttribute("style", "padding-left: 15px; color: red;");
                    td.appendChild(document.createTextNode(row.repObject.response.error))

                    event.target.setAttribute("class", "fs-opened error");
                } else {
                    event.target.setAttribute("class", "fs-opened");
                }

            } else if (Css.hasClass(event.target, "fs-opened")){

                table.deleteRow(row.rowIndex+1)
                Css.removeClass(event.target, "fs-opened");

                if(Css.hasClass(event.target,"error")){
                    Css.removeClass(event.target, "error");
                    table.deleteRow(row.rowIndex+1)
                }

                event.target.setAttribute("class", "fs-closed");
            }

        },

        /**
         * Method to truncate the HTML and present an exerpt in the report
         * 
         * @param  {String}     text    String to truncate
         * @param  {Integer}    maxchar Number of maximum character to use
         * @return {String}             Truncated string
         */
        generateExerpt: function(text, maxchar)
        {
            if (!maxchar)
                var maxchar = 30;

            if (text.length > maxchar)
                return text.substring(0,maxchar-3)+"...";
            else
                return text;
        },

        /**
         * Method to parse and open HTML from the page worker and show it in the HTML pad.
         * Taken from firebug/net/xmlviewer
         * 
         * @param  {HTMLPanel}  HTMLPanel  HTMl panel
         * @param  {String}     text       HTML String to parse and show
         * @return {void}            
         */
        insertHTML: function(HTMLPanel, text)
        {
            var parser = Xpcom.CCIN("@mozilla.org/xmlextras/domparser;1", "nsIDOMParser");
            var doc = parser.parseFromString(text, "text/html");
            var root = doc.documentElement;

            // Error handling
            var nsURI = "http://www.mozilla.org/newlayout/xml/parsererror.xml";
            if (root.namespaceURI == nsURI && root.nodeName == "parsererror")
            {
                this.ParseError.tag.replace({error: {
                    message: root.firstChild.nodeValue,
                    source: root.lastChild.textContent
                }}, parentNode);
                return;
            }

            HTMLPanel.select(doc.documentElement)

            //Firebug.HTMLPanel.CompleteElement.tag.replace({object: doc.documentElement}, parentNode);

        }
    })
}

// ********************************************************************************************* //
// Registration

Firebug.registerPanel(Firebug.FireStormPanel);

Firebug.registerStylesheet("chrome://firestorm/skin/firestorm.css");

if (FBTrace.DBG_FIRESTORM)
    FBTrace.sysout("fireStorm; fireStormPanel.js, stylesheet registered");

return Firebug.FireStormPanel;

// ********************************************************************************************* //
});