/* See license.txt for terms of usage */

define([
    "firebug/lib/trace",
    "firestorm/fireStormPanel"
],
function(FBTrace, FireStormPanel) {

// ********************************************************************************************* //
// Documentation

// Firebug coding style: http://getfirebug.com/wiki/index.php/Coding_Style
// Firebug tracing: http://getfirebug.com/wiki/index.php/FBTrace

// ********************************************************************************************* //
// The application/extension object

var FireStorm =
{
    initialize: function()
    {
        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStorm extension initialize");

        // Registration of Firebug panels and modules is made within appropriate files,
        // but it could be also done here.
        // Extension initialization
    },

    shutdown: function()
    {
        if (FBTrace.DBG_FIRESTORM)
            FBTrace.sysout("fireStorm; FireStorm extension shutdown");

        // Unregister all registered Firebug components
        Firebug.unregisterPanel(Firebug.FuzzingSidePanel);
        Firebug.unregisterPanel(Firebug.FireStormPanel);
        Firebug.unregisterStylesheet("chrome://FireStorm/skin/firestorm.css");
        Firebug.unregisterStringBundle("chrome://FireStorm/locale/firestorm.properties");

        // Extension shutdown
    }
}

// ********************************************************************************************* //

return FireStorm;

// ********************************************************************************************* //
});
