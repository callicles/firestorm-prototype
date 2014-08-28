/* See license.txt for terms of usage */

// This line is to enable debuging massaging and module structure in workers
importScripts(
    "chrome://firestorm/content/generation/generationModule.js"
    );

// ********************************************************************************************* //
// Special Character generation Module
// 
// This generation module is a templating generation module to show how to implement generation
// modules.
// 
// It generates batches of Strings containing special characters.

var specialCharGenModule = Obj.extend(GenerationModule,
{

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module MetaData and methods to be overriden
    // 
    
    name: "Special Char Generator",
    description: "This module generates special characters to test filtering functions",

    brainModulesCompatible: [],
    
    /**
     * Generates a batch of Strings with special chars inside 
     * 
     * @param  {Integer}    batchSize   Size of the requested data batch
     * @return {Array}      Array corresponding to a batch of generated data
     */
    generate: function(batchSize){
        var toReturn = [];

        for (var i = 0 ; i<batchSize ; i++){
            toReturn.push(i);
        }

        return toReturn;
    }

});

// ********************************************************************************************* //
// Registration

onmessage = function(e){
    specialCharGenModule.onMessage(e,specialCharGenModule);
};