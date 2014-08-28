
// ********************************************************************************************* //
// module Worker
// 
// This is the super Class for worker modules. It is used to configure require so that each
// module can be declared as such in a worker. 
// 
// It is also used to set every debug or utility function that would be needed in a module 
// 

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
// Worker message handling

/**
 * Object representing a message exchanged between the main thread and this worker.
 * @type {Object}
 */
var message = {
        debug: false,
        class : "",
        payload: null
    };

/**
 * Function to use for sending debuging messages to the console. As we are in a worker, we
 * cannot use debugging messages as we do in the main thread, they have to be sent back
 * to it to be displayed.
 * 
 * @param  {String} string Message to send to the debugging console.
 * @return {void}          Sends the message to the main thread.
 */
function debugMessage (string, data){
   message.debug = true;
   message.class = "debug";
   message.payload = {header: string, content: data};
   postMessage(message);
}

/**
 * Object extracted from firebug to manage Object extension and adapted to work in a Worker
 * @type {Object}
 */
var Obj = {}

/**
 * Function to implement heritage
 * 
 * @return {Object} parent object extended with the argument
 */
Obj.extend = function()
{
    if (arguments.length < 2)
    {
        debugMessage("object.extend; ERROR", arguments);
        throw new Error("Obj.extend on undefined object");
    }

    var newOb = {};
    for (var i = 0, len = arguments.length; i < len; ++i)
    {
        var ob = arguments[i];
        for (var prop in ob)
        {
            // Use property descriptor to clone also getters and setters.
            var pd = Object.getOwnPropertyDescriptor(ob, prop);
            if (pd)
                Object.defineProperty(newOb, prop, pd);
            else
                newOb[prop] = ob[prop];
        }
    }

    return newOb;
};

