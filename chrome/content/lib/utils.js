/* See license.txt for terms of usage */

define([
    "firebug/lib/trace",
],
function(FBTrace) {

// ********************************************************************************************* //
// This is a library of useful helpers

    var lib = {},
        __nativeSI__ = window.setInterval,
        __nativeST__ = window.setTimeout;

    /**
     * Used to convert an object with properties as a list of its properties
     */
    lib.mapToList = function(map)
    {
        list = [];
        for (key in map)
            list.push(map[key]);
        return list
    };


    /**
     * The scripts a delivered as arrays of code lines. We need to concatenate them
     *  to treat it as a String. 
     *  
     * @param  {Array} array to convert.
     * @return {String}      converted string.
     */
    lib.linesArrayToString = function(array)
    {
        var str = "";

        for (var i = 0 ;  i<array.length ; i++){
            str = str + array[i];
        }
        return str;
    };

    /**
     *  Retrives a file name from a URL/path.
     *  ex: http://test/file.js --> file.js
     */
    lib.getFileName = function(href){
        return href.substring(href.lastIndexOf('/')+1);
    };

    lib.setInterval = function (vCallback, nDelay) {
      var oThis = this, aArgs = Array.prototype.slice.call(arguments, 2);
      return __nativeSI__(vCallback instanceof Function ? function () {
        vCallback.apply(oThis, aArgs);
      } : vCallback, nDelay);
    };

    lib.setTimeout = function (vCallback, nDelay) {
      var oThis = this, aArgs = Array.prototype.slice.call(arguments, 2);
      return __nativeST__(vCallback instanceof Function ? function () {
        vCallback.apply(oThis, aArgs);
      } : vCallback, nDelay);
    };

    return lib;
});