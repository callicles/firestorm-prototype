

// Objects & librairies for using parse trees
importScripts(
    "chrome://firestorm/content/lib/functionTree.js",
    "chrome://firestorm/content/lib/nameChecker.js",
    "chrome://firestorm/content/lib/estraverse.js"
    );
// ********************************************************************************************* //
// ScriptAnalyserWorker -
// This script is executed in an independent thread and context. It communicates with the main
// thread with messages. No concurrence issue should be expected as each thread can be
// reduced to an actor. A worker is the name of a thread in a web browsing context.

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
// Global variables

const WORKER_DEBUG = true ;

const _identifier = "Identifier";
const _functionDeclaration = "FunctionDeclaration";
const _functionExpression = "FunctionExpression";
const _assignmentExpression = "AssignmentExpression";
const _variableDeclarator = "VariableDeclarator";
const _memberExpression = "MemberExpression";
const _property = "Property";
const _objectExpression = "ObjectExpression";
const _callExpression = "CallExpression";


// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
// Actor message handling

/**
 * Object representing a message exchanged between the main thread and this worker.
 * @type {Object}
 */
var message = {
        debug: false,
        payload: null
    };


/**
 * Function to use for sending debuging messages to the console. As we are in a worker, we
 * cannot use debugging messages as we do in the main thread, they have to be sent back
 * to it to be displayed.
 * 
 * @param  {String} string Message to send to the debugging console.
 * @param  {Object} data   Object to be deisplayed in the console
 * @return {void}          Sends the message to the main thread.
 */
function debugMessage (string, data){
   message.debug = true;
   message.payload = {header: string, content: data};
   postMessage(message);
}

/**
 * Function to use for sending analysis response messages to the main thread
 * 
 * @param  {FunctionLeaf} functionLeaf function Leaf represnting the script
 * @return {void}                      sends a message to the main thread
 */
function analysisResponse(functionLeaf){
    message.debug = false;
    message.payload = {
        type: "analysisResponse",
        content: functionLeaf
    };
    postMessage(message);
}

/**
 * This is the worker message listener. It is responsible for handling messages from the
 * main thread so that everything gets executed properly.
 * 
 * @param  {Event} event Message event
 * @return {void}        Dispatches the function calls in the worker.
 */
onmessage = function(event){
    if (event.data.command === "ping"){                                                                 // Check the communication between the worker and the main
        debugMessage("fireStorm; ScriptAnalyserWorker.Pong");                                           // Thread
    } else if (event.data.command === "analyse"){


        var functionTree = cloneFunctionTree(event.data.payload.functionTree);

        var newScriptRoot = new FunctionLeaf(
            functionTree.children[functionTree.children.length - 1].path[0]
        );

        // Retrieval of the Abstract Synthax tree for function
        var AST = event.data.payload.ast;


        Analyser.mapSourceLines(event.data.payload.source);
        Analyser.functionDeclarationIndexer(newScriptRoot, AST);

        newScriptRoot.range.start = 0;
        newScriptRoot.range.end = event.data.payload.source.length;

        functionTree.children[functionTree.children.length - 1] = newScriptRoot;


        var response = Analyser.functionUseIndexer(
            AST,
            functionTree
        );

        debugMessage("response", response)

        analysisResponse(response);
    }
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
// Function Declaration index

var Analyser = {

    /**
     * This attribute is used to reference the character index of the beginning of each line so that with the
     * information given by the AST we are able to precisely determine function declaration beginning and end with
     * character index. locationMap[10] represents the index of the first character of the tenth line.
     */
    locationMap: [0,0],

    /**
     * Fills the location Map
     *
     * @param source analysed script
     */
    mapSourceLines: function(source){

        const sourceArray = source.split("");
        var self = this;

        this.locationMap = [0,0];

        sourceArray.forEach(function(char, index){
            if (char === '\n')
                this.locationMap.push(index+1);
        }, self);

        if(WORKER_DEBUG)
            debugMessage("firestorm; ScriptAnalyserWorker.mapSourceLines",{
                source: source,
                locationMap: this.locationMap
            });
    },

    /**
     * Function that returns the function Tree representation of function declarations
     *
     * @param scriptRoot function Leaf to attach function declaration to
     * @param AST Abstract Syntax tree of the file
     * @return {functionLeaf}
     */
    functionDeclarationIndexer: function(scriptRoot, AST){

        var functionParentStack = [scriptRoot],
            nodeStack = [],
            self = this;

        if(WORKER_DEBUG)
            debugMessage("firestorm; ScriptAnalyserWorker.functionDeclarationIndexer",{
                scriptRoot: scriptRoot,
                AST: AST
            });

        estraverse.traverse(AST, {
            enter: function(node, parent){

                if(node.type === _functionDeclaration) {
                    // the last element of the stack is the parent of the current function declaration
                    var newFunctionLeaf = self.addFunctionDeclaration(
                        functionParentStack[functionParentStack.length - 1],
                        node
                    );
                    functionParentStack.push(newFunctionLeaf);
                    node.indexMarker = true;

                } else if (node.type === _functionExpression)
                    switch(parent.type){
                        case _assignmentExpression:
                            var newFunctionLeaf = self.addObjectPropertyFunctionAssignment(
                                functionParentStack[functionParentStack.length-1],
                                parent
                            );
                            functionParentStack.push(newFunctionLeaf);
                            node.indexMarker = true;
                            break;

                        case _variableDeclarator:
                            var newFunctionLeaf = self.addVariableFunctionAssignment(
                                functionParentStack[functionParentStack.length-1],
                                parent,
                                nodeStack.map(function(node){return node}).reverse()[1]
                            );
                            functionParentStack.push(newFunctionLeaf);
                            node.indexMarker = true;
                            break;

                        case _property:
                            var newFunctionLeaf = self.addObjectPropertyToObject(
                                functionParentStack[functionParentStack.length-1],
                                node,
                                parent,
                                nodeStack
                            );
                            if (newFunctionLeaf != -1) {
                                functionParentStack.push(newFunctionLeaf);
                                node.indexMarker = true;
                            }
                            break;
                    }
                nodeStack.push(node);
            },
            leave: function(node){
                if(node.indexMarker)
                    functionParentStack.pop();
                nodeStack.pop();
            }
        });
    },

    /**
     * Adds to the parent the node as functionLeaf child
     * ex: function test(alpha, beta){};
     *
     * @param parent functionLeaf parent
     * @param node AST function declaration node
     * @return functionLeaf created
     */
    addFunctionDeclaration: function(parent, node){
        if(WORKER_DEBUG)
            debugMessage("firestorm; addFunctionDeclaration",{
                parent: parent,
                node: node
            });

        var newLeaf = new FunctionLeaf(parent.getPath()+'/'+node.id.name);

        newLeaf.setRange(
                this.locationMap[node.loc.start.line]+node.loc.start.column+1,
                this.locationMap[node.loc.end.line]+node.loc.end.column+1
        );
        node.params.forEach(function(arg) {
            newLeaf.appendArg(arg.name);
        });

        parent.appendChild(newLeaf);

        return newLeaf;
    },

    /**
     * Adds to the parent the node as functionLeaf child
     * ex: object.test = function(alpha, beta){};
     *
     * @param parent functionLeaf parent
     * @param assignmentNode object assignment node with a function declaration nested
     * @return functionLeaf created
     */
    addObjectPropertyFunctionAssignment: function(parent, assignmentNode){

        if(WORKER_DEBUG)
            debugMessage("firestorm; addObjectPropertyFunctionAssignment",{
                parent: parent,
                node: assignmentNode
            });


        const node = assignmentNode.right;
        const id = this.findChainedFunctionIdentifier(assignmentNode.left);

        var newLeaf = new FunctionLeaf(parent.getPath()+'/'+id);

        newLeaf.setRange(
                this.locationMap[node.loc.start.line]+node.loc.start.column+1,
                this.locationMap[node.loc.end.line]+node.loc.end.column+1
        );

        node.params.forEach(function(arg) {
            newLeaf.appendArg(arg.name);
        });

        parent.appendChild(newLeaf);

        return newLeaf;
    },

    /**
     * Adds to the parent the node as functionLeaf child
     * ex: var a = function(alpha,beta){};
     *
     * @param parent functionLeaf parent
     * @param declaratorNode variable declaration containing a function
     * @param grandParent VariableDeclaration Node used to get the location limits
     * @return functionLeaf created
     */
    addVariableFunctionAssignment: function(parent, declaratorNode, grandParent){

        if(WORKER_DEBUG)
            debugMessage("firestorm; addVariableFunctionAssignment",{
                parent: parent,
                node: declaratorNode
            });
        const lastDeclaration = grandParent.declarations[grandParent.declarations.length - 1];
        const id = this.findChainedFunctionIdentifier(declaratorNode.id);
        var newLeaf = new FunctionLeaf(parent.getPath()+'/'+id);

        newLeaf.setRange(
                this.locationMap[lastDeclaration.loc.start.line]+lastDeclaration.loc.start.column+1,
                this.locationMap[lastDeclaration.loc.end.line]+lastDeclaration.loc.end.column+1
        );

        declaratorNode.init.params.forEach(function(arg) {
            newLeaf.appendArg(arg.name);
        });

        parent.appendChild(newLeaf);

        return newLeaf;
    },

    /**
     * Adds to the parent the node as functionLeaf child. This function handles objects
     * ex: var a = {
     *        test: function(){}
     *     }
     *
     * @param parent functionLeaf parent
     * @param node property declaration containing a function
     * @param nodeStack node stack
     * @return functionLeaf created
     */
    addObjectPropertyToObject: function(functionLeafParent, node, parent, nodeStack){
        if(WORKER_DEBUG)
            debugMessage("firestorm; addObjectPropertyToObject",{
                functionLeafParent: functionLeafParent,
                node: node,
                parent: parent,
                nodeStack: nodeStack
            });

        // We order the stack from bottom of the tree to up
        const orderedStack = nodeStack.map(function(node){return node}).reverse();

        var names = [],
            foundObjectRoot = false,
            assignmentNode = undefined,
            cursor = undefined,
            self = this,
            id = undefined,
            newLeaf = undefined,
            index = 0;


        // We crawl the stack to find the object declaration in which is declared the function
        for (; index < orderedStack.length && !foundObjectRoot ; index++) {
            cursor = orderedStack[index];

            // Case the function is in an object that's a property
            if (!foundObjectRoot && cursor.type === _property)
                names.push(self.findChainedFunctionIdentifier(cursor.key));
            // Case we found an object expression
            else if (cursor.type === _objectExpression) {
                // the object is assigned to an object property
                if (orderedStack[index + 1].type === _assignmentExpression ||
                    //or the object is declared as a variable, o
                    orderedStack[index + 1].type === _variableDeclarator ||
                    // the object is extending another object (JQuery)
                    (orderedStack[index + 1].type === _callExpression &&
                        orderedStack[index + 1].callee.property.name === "extend")) {

                    assignmentNode = orderedStack[index + 1];
                    foundObjectRoot = true;
                }
            } else if (index == orderedStack.length - 1){
                debugMessage("Error, AnalyserWorker.addObjectPropertyToObject - Object Root not found",{
                    node: node,
                    orderedStack: orderedStack,
                    names : names
                });
                return -1;
            }
        }

        names.reverse();

        if (assignmentNode.type === _assignmentExpression){
            id = this.findChainedFunctionIdentifier(assignmentNode.left)+'.'+names.join('.');
            newLeaf = new FunctionLeaf(functionLeafParent.getPath()+'/'+id);
            newLeaf.setRange(
                    this.locationMap[assignmentNode.right.loc.start.line]+assignmentNode.right.loc.start.column+1,
                    this.locationMap[assignmentNode.right.loc.end.line]+assignmentNode.right.loc.end.column+1
            );
        } else if (assignmentNode.type === _variableDeclarator){
            id = this.findChainedFunctionIdentifier(assignmentNode.id)+'.'+names.join('.');
            newLeaf = new FunctionLeaf(functionLeafParent.getPath()+'/'+id);
            newLeaf.setRange(
                    this.locationMap[orderedStack[index + 2].loc.start.line]+orderedStack[index + 2].loc.start.column+1,
                    this.locationMap[orderedStack[index + 2].loc.end.line]+orderedStack[index + 2].loc.end.column+1
            );
        } else if (assignmentNode.type === _callExpression && assignmentNode.callee.property.name === "extend"){
            if (assignmentNode.arguments.length == 1)
                id = this.findChainedFunctionIdentifier(assignmentNode.callee.object)+'.'+names.join('.');
            else if (assignmentNode.arguments.length == 2)
                id = this.findChainedFunctionIdentifier(assignmentNode.arguments[0])+'.'+names.join('.');
            else
                throw "Error, AnalyserWorker.addObjectPropertyToObject - jQuery extend has none or over 2 arguments";

            newLeaf = new FunctionLeaf(functionLeafParent.getPath()+'/'+id);
            newLeaf.setRange(
                    this.locationMap[assignmentNode.loc.start.line]+assignmentNode.loc.start.column+1,
                    this.locationMap[assignmentNode.loc.end.line]+assignmentNode.loc.end.column+1
            );
        }

        node.params.forEach(function(arg) {
            newLeaf.appendArg(arg.name);
        });

        functionLeafParent.appendChild(newLeaf);

        return newLeaf;
    },

    /**
     * Used to get a function identifier from an ast node when object nodes are chained
     *      ex: object.toto.tata = function(){};
     *
     * @param node
     * @returns {string}
     */
    findChainedFunctionIdentifier: function(node){
        if (node.type === _memberExpression)
            return this.findChainedFunctionIdentifier(node.object)+'.'+node.property.name;
        else if (node.type === _identifier)
            return node.name;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Function Use index

    /**
     * Function to complete the function tree with the functions calls 
     * 
     * @param  {Object}         AST            Abstract Syntax tree of the function
     * @param  {functionTree}   parentFunction function Tree to get the references from
     * @return {functionTree}                  Completed function tree
     */
    functionUseIndexer: function(AST, parentFunction)
    {
        var calls = [];                               
                                                        
        if (WORKER_DEBUG)
            debugMessage("fireStorm; ScriptAnalyserWorker.functionUseIndexer",{
                    "AST": AST
                });

        estraverse.traverse(AST, {                                                                      // Go through all the tree to find function calls   
            enter: function(node){
                if (node.type === 'CallExpression')
                    calls.push(node);
            }
        });

        if (WORKER_DEBUG)
            debugMessage("fireStorm; ScriptAnalyserWorker.functionUseIndexer \
                Calls Expressions found", {
                "calls": calls
            });

        parentFunction = this.depthfirstSeach(parentFunction, calls);                                   // For all the found calls - match it with a function
                                                                                                        // declaration
        return parentFunction;
    },

    /**
     * This function is used to check if a function call is in a function Leaf by comparing the ends
     * and the beginning of both functions.
     * 
     * @param  {CallExpression} functionCall CallExpression gotten from the the AST
     * @param  {FunctionLeaf} functionLeaf functionLeaf to check if its a caller.
     * 
     * @return {Boolean}              Whether or not on function is called by the other.
     */
    compareRange: function(functionCall, functionLeaf)
    {
        var isfunctionCallingFunctionLeaf = true,
            functionCallStart = this.locationMap[functionCall.loc.start.line]+functionCall.loc.start.column+1,
            functionCallEnd = this.locationMap[functionCall.loc.end.line]+functionCall.loc.end.column+1;

        if (functionLeaf.range.start <= functionCallStart &&
            functionLeaf.range.end >= functionCallEnd){

            if (functionLeaf.hasChildren()){

                var children = functionLeaf.getChildren();
                for (var i = 0 ; i< children.length ; i++){
                    if (children[i].range.start <= functionCallStart &&
                        children[i].range.end >= functionCallEnd){
                        isfunctionCallingFunctionLeaf = false;
                        break;
                    }
                }
            }
        } else {
            isfunctionCallingFunctionLeaf = false;
        }

        if (WORKER_DEBUG && false)
            debugMessage("fireStorm; ScriptAnalyserWorker.compareRange \
                Comparing", {
                "functionCall": functionCall,
                "functionLeaf": functionLeaf,
                "result":isfunctionCallingFunctionLeaf
            });
                
        return isfunctionCallingFunctionLeaf;
        
    },

    /**
     * This is the method tha finds the function declaration made from the calls. If it is a built-in
     * function, it won't find anything.
     * 
     * @param  {FunctionTree}   functionTree    Function declaration index
     * @param  {Array}          calls           Array of CallExpressions
     * 
     * @return {FunctionTree}                   Completed function Tree
     */
    depthfirstSeach: function(functionTree, calls)
    {
        var queue = [functionTree];
        while (queue.length != 0 && calls.length > 0){

            var cursor = queue.pop();

            if (cursor.range){
                for (var i = 0 ; i< calls.length ; i++){
                    if (this.compareRange(calls[i], cursor)){
                        cursor.appendUsedFunction({
                            "name": this.getCallExpressionName(calls[i], cursor),
                            "loc": calls[i].loc,
                            "arguments": calls[i].arguments
                        });
                        if (calls[i].callee.type !== "FunctionExpression"){                             // When a callee is a FunctionExpression, it means that
                            if (!this.indexDeclarationPath(                                             // the called function is an Imediately invoked function
                                    functionTree,                                                       // Expression, as such it doesn't have any names and is 
                                    cursor,                                                             // not referenced anywhere.
                                    0 , 
                                    this.getNestedDegree(cursor)+1
                                )
                            ){
                            /*
                                debugMessage("fireStorm; ScriptAnalyserWorker.depthfirstSeach \
                                    DECLARATION NOT FOUND", {
                                    "cursor": cursor,
                                    "calls[i]": calls[i]
                                });
                            */
                            }

                        }

                        calls.splice(i,1);
                        i--;
                    }
                }
            }
            if (cursor.hasChildren()){
                var children = cursor.getChildren();
                for (var i = 0 ; i< children.length ; i++){
                    queue.push(children[i])
                }
            }
            
        }
        return functionTree;
    },


    /**
     * Function that walks down the function tree to spot the function declaration of the called
     * function
     * 
     * @param  {functionTree}   functionLeaf        Global function tree
     * @param  {functionLeaf}   parentFunction      Function leaf calling the function
     * @param  {Integer}        nestedDegree        Nested degree of the function leaf
     * @param  {Integer}        nestedDegreeLimit   Nestedness limit to explore in the tree
     * @return {Boolean}                            Returns true if the Declaration was found, returns
     *                                              false otherwise 
     */
    indexDeclarationPath: function(functionLeaf, parentFunction, nestedDegree, nestedDegreeLimit)
    {
        var calledFunction = parentFunction.usedFunctions[parentFunction.usedFunctions.length -1],
            found = false;

        if (nestedDegreeLimit >= nestedDegree &&
            functionLeaf.hasChildren()){

            var children = functionLeaf.getChildren();
            nestedDegree++;
            for (var i = 0 ; i < children.length ; i++){

                found = found || this.indexDeclarationPath(
                    children[i],
                    parentFunction,
                    nestedDegree,
                    nestedDegreeLimit
                );
            }
        }
        if(functionLeaf.range){
            for (var i = 0 ; i< functionLeaf.path.length ; i++){
                if (calledFunction.name === functionLeaf.getName(i)){
                    calledFunction.path = functionLeaf.getPath();
                    found = true;
                }
            }
        }
        return found;
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

        return path.split('/').length - 1;
    },

    /**
     * Helper to get a called function name from the Mozilla AST type CallExpression
     * 
     * @param  {CallExpression} CallExpression CallExpression AST node
     * @param  {FunctionLeaf}   parentFunction parentFunction of the called function
     * @return {String}                        Expression Name (identifier)
     */
    getCallExpressionName: function(CallExpression, parentFunction){
        if (CallExpression.callee.type === "Identifier"){
            return CallExpression.callee.name;
        } else if (CallExpression.callee.type === "MemberExpression") {
            return this.getMemberExpressionName(CallExpression.callee, parentFunction);
        } else if (CallExpression.callee.type === "FunctionExpression"){
            return "Immediatly Invoked Function Expression"
        }
    },

    /**
     * Helper to retrieve a called function name from the Mozilla AST type MemberExpression
     * 
     * @param  {MemberExpression} MemberExpression MemberExpression AST node
     * @param  {FunctionLeaf}   parentFunction parentFunction of the called function
     * @return {String}                            Expression Name (identifier)
     */
    getMemberExpressionName: function(MemberExpression, parentFunction)
    {
        if (MemberExpression.type === "MemberExpression"){
            return ''+this.getMemberExpressionName(MemberExpression.object, parentFunction)
                     +'.'+MemberExpression.property.name;
        } else if (MemberExpression.type === "Identifier"){
            return ''+MemberExpression.name;
        } else if (MemberExpression.type === "ThisExpression" && parentFunction.fromObject != null){
            return ''+parentFunction.fromObject.name;
        } else if (MemberExpression.type === "ThisExpression") {
            return ''+parentFunction.getName();
        } else {
            return "";
        }
    }
};
