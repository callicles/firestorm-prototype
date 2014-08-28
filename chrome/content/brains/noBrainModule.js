/* See license.txt for terms of usage */

// This line is to enable debuging massaging and module structure in workers
importScripts("chrome://firestorm/content/brains/brainModule.js");

// ********************************************************************************************* //
// No Brainer Brain Module
// 
// This brain module is a template module that basically does nothing special and serves as a proxy
// between the dispatcher and the generators

var noBrainModule  = Obj.extend(BrainModule,
{

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module MetaData and methods to be overriden
    // 
    
    name: "no Brainer",
    description: "No treatment on fuzzing data sessions",

    genModulesCompatible: ['*'],                                                                             

    handleGeneration: function(batchSize, previousBatch){
        for (var i = 0 ; i < this.genWorkers.length ; i++){                                             // Sends a generation request to all the generation modules
            this.genWorkers[i].worker.postMessage(                                                      // plugged in
                {                                                                                       // this.genWorker is an array of all the module selected by
                    command: "generate",                                                                // the user loaded as workers.
                    payld: {                                                                            // To ask them to generate batch data you just have to send
                        id: i,                                                                          // them a message as shown beside. The id is the index of
                        batchSize: batchSize,                                                           // the worker, the batch size requested by the user and 
                        args: []                                                                        // args corresponds to the arguments to send the generate
                    }                                                                                   // FromParameters function. If no argument is passed,
                }                                                                                       // the generate function is used. By moduling that 
            );                                                                                          // parameter that you can change the batch generated data.
        }
    },

    /**
     * This method is called when all the generators have sent they respective generated batches.
     * It is responsible for returning all the arguments batches that will be used for the fuzzing.
     * as the following format.
     *
     *  [
     *      [arg1, arg2, arg3, ... ],                 --> arguments to use for the first execution
     *      [arg1, arg2, arg3, ... ],                 --> arguments to use for the second execution
     *                  .
     *                  .
     *                  .
     *  ]
     * 
     * @param  {Array} generatedBatches this corresponds to BrainModule.currentBatc
     *                                  it is of the form:
     *                                  [
     *                                      {
     *                                          id: <argumentId>,
     *                                          batch: <dataBatch>
     *                                      },
     *                                                 .
     *                                                 .
     *                                                 .
     *                                  ]
     * @return {Array}                  Array of argument lists to feed to the fuzzed function
     */
    sendBatchToBeFuzzed: function(generatedBatches){

        generatedBatches = generatedBatches.sort(function(a,b){
            return a.id - b.id;
        });

        var batchOfArguments = [], 
            max = generatedBatches.length-1;


        function helper(arr, i){
            for (var j = 0, l = generatedBatches[i].batch.length ; j<l ; j++){
                var temp = arr.slice(0);                                                                // copy the array
                temp.push(generatedBatches[i].batch[j]);
                if(i == max)
                    batchOfArguments.push(temp);
                else
                    helper(temp,i+1)
            }
        }

        helper([],0);

        return batchOfArguments;
    }

});

// ********************************************************************************************* //
// Registration

onmessage = function(e){
    noBrainModule.onMessage(e,noBrainModule);
};