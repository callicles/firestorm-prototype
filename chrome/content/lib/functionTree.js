/* See license.txt for terms of usage */


var EXPORTED_SYMBOLS = ["FunctionTree","FunctionLeaf","cloneFunctionTree","cloneFunctionLeaf"]

// ********************************************************************************************* //
// Function Leaf representation

/*
    A leaf represents a function.
    Each leaf can have children as leaf, they represent the nested functions.
    As of object functions:
        Consider this kind of code

        -----------------------------------------------------------

            function test(){                    -> Level n
                var obj = {
                    test2: function(){          -> Level n + 1
                        // do Something
                    }    
                }

                function nestedFunction (){     -> Level n + 1
                    // do something
                }
            }

        -----------------------------------------------------------

        test2 and nested function are considered at the same depth.

*/

function FunctionLeaf(path) {

    /*
        The root element of the path represents the script name, then the next depths
        represent functions.
            ex: /script1/functionA/nestedFunctionB
        There can be multiple path for a function because a function can be declared
        multiple times like the extend function in jQuery
            var jQuery.extend = jQuery.fn.extend =  ... 
        By default the path exposed is the first one, the other ones are used for function
        use recognition. 
    */
    this.path = [""+path];               
    this.children = [];

    /* 
        We want to be able to fuzz different arguments so that we have to store the
        number of arguments and how they are called (to hint what kind of input they
        require)
     */
    this.args = [];

    /*
        This list represents all the functions that are used inside the body of this
        function. It is a list of references made as URLs.

        For example: pageName/scriptName/test/test2
        ('/' is not a valid character for variable naming, so it can be used as a path
        separator)
    */
    this.usedFunctions = [];

    /*
        This property is specific for functions declared in objects. During the
        fuzzing, as we want to trigger the function, we need the object reference,
        this property is here to provide it. The Object reference only needs to be an
        object containing the object ref and the index of its declaration end.
    */
    this.fromObject = null;

    /*
        This property is used when we are fuzzing a function, it serves as a landmark
        to where we shall insert our fuzzing code.
    */
    this.range = {start: -1, end: -1};

    /**
     * Contains the source code of the function. Can be usefull for user info and for 
     * annonymous function execution. This is an array for conditional declarations so
     * that it contains all the alternatives.
     * 
     * @type {Array}
     */
    this.functionSource = [];
}

FunctionLeaf.prototype = 
{

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
// Accessors

    appendChild: function(child)
    {
        this.children.push(child);
    },

    hasChildren: function()
    {
        return this.children.length > 0;
    },

    getChildren: function()
    {
        return this.children;
    },

    appendUsedFunction: function(usedFunction)
    {
        this.usedFunctions.push(usedFunction);
    },

    hasUsedFunctions: function()
    {
        return this.usedFunctions.length > 0;
    },

    appendArg: function(arg)
    {
        this.args.push(arg);
    },

    hasArgs: function()
    {
        return this.args.length > 0;
    },

    isMethod: function()
    {
        return this.fromObject != null;
    },

    getObject: function()
    {
        if(this.isMethod())
            return this.fromObject;
    },

    setParentObject: function(strRef)
    {
        this.fromObject = strRef;
    },

    getPath: function()
    {
        return this.path[0];
    },

    getName: function(i)
    {
        if (i)
            return this.path[i].substring(this.path[i].lastIndexOf('/')+1,this.path[i].length);
        else
            return this.path[0].substring(this.path[0].lastIndexOf('/')+1,this.path[0].length);
    },

    setRange(i,j)
    {
        this.range.start = i;
        this.range.end = j;
    },

    getCharEnd: function()
    {
        return this.range.end;
    },

    getCharStart: function()
    {
        return this.range.start;
    },

    getSource: function()
    {
        return this.functionSource;
    },

    appendSource: function(source)
    {
        this.functionSource.push(source);
    },

    findLeafFromPath: function(path)
    {
        var totalDepth = path[0].split('/').length + 1,
            depth = this.path[0].split('/').length + 1;

        if (totalDepth - depth == 1){
            return this.children.find(function(element, index, array){
                return element.path[0] ===path[0] ;
            });
        } else {
            return this.children.find(function(element, index, array){
                return element.path[0] === path[0].split('/',depth).join('/');
            }).findLeafFromPath(path);
        }

    },

    getDependencies: function(functionTree){
        var pathArray = this.path[0].split('/'),
            dependencies = [];

        if (pathArray.length > 2)
            for (var i = 3 ; i<pathArray.length; i++){
                dependencies.push(functionTree.findLeafFromPath(pathArray.slice(0,i).join('/')));
            }

        return dependencies;

    }
}

/**
 * Method to clone a function leaf from its serialized version
 * 
 * @param  {Object}         functionLeafStruct Function leaf extracted from a message 
 * @return {FunctionLeaf}                      Cloned function leaf
 */
function cloneFunctionLeaf(functionLeafStruct)
{
    var clonedFunctionLeaf = new FunctionLeaf(functionLeafStruct.path);
    clonedFunctionLeaf.path = functionLeafStruct.path.slice(',');

    clonedFunctionLeaf.args = functionLeafStruct.args;
    clonedFunctionLeaf.usedFunctions = functionLeafStruct.usedFunctions;
    clonedFunctionLeaf.fromObject = functionLeafStruct.fromObject;
    clonedFunctionLeaf.range = functionLeafStruct.range;
    clonedFunctionLeaf.functionSource = functionLeafStruct.functionSource;

    if (functionLeafStruct.children.length > 0)
        clonedFunctionLeaf.children = functionLeafStruct.children.map(cloneFunctionLeaf);

    return clonedFunctionLeaf;
}


// ********************************************************************************************* //
// Function Tree representation

/*
    This tree contains access to all the functions contained in a Web page.
    Each of its leaf represents a script file that contains other functions
    This is the root of the tree

    The tree's leaf are ordered so that it represents the declaration order of the script file
*/
function FunctionTree(pageName) {

    this.pageReference = pageName;
    // the children of a function tree for a page are the different scripts.
    this.children = [];
}

FunctionTree.prototype = 
{
    appendChild: function(child)
    {
        this.children.push(child);
    },

    hasChildren: function()
    {
        return this.children.length > 0;
    },

    getChildren:function()
    {
        return this.children;
    },

    getPath: function()
    {
        return '/';
    },
    
    getName: function()
    {
        return this.pageReference;
    },

    findLeafFromPath: function(path)
    {
        var totalDepth = path.split('/').length + 1,
            depth = 1;

        if (totalDepth - depth == 1){
            return this.children.find(function(element, index, array){
                return element.path === path ;
            });
        } else {
            return this.children.find(function(element, index, array){
                return element.path[0] === path.split('/',depth+1).join('/');
            }).findLeafFromPath([path]);
        }

    },
}

/**
 * Method to clone a function Tree from its serialized version
 * 
 * @param  {Object}         functionTreeStruct Function leaf extracted from a message 
 * @return {FunctionTree}                      Cloned function Tree
 */
function cloneFunctionTree(functionTreeStruct)
{
    var clonedFunctionTree = new FunctionTree(functionTreeStruct.pageName);

    if (functionTreeStruct.children.length > 0)
        clonedFunctionTree.children = functionTreeStruct.children.map(cloneFunctionLeaf);

    return clonedFunctionTree;
}
