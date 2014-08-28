/* See license.txt for terms of usage */

// This line is to enable debuging massaging and module structure in workers
importScripts(
        "chrome://firestorm/content/generation/generationModule.js",
        "chrome://firestorm/content/generation/lib/chance.js"
);


var chance = new Chance.Chance();

// ********************************************************************************************* //
// Special Character generation Module
// 
// This generation module is a templating generation module to show how to implement generation
// modules.
// 
// It generates batches of Strings containing special characters. 

var HTMLGenModule = Obj.extend(GenerationModule,
{

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module MetaData and methods to be overriden
    // 
    
    name: "HTML Generator",
    description: "This module generates broken HTML code by randomly selecting HTML tags from a list",

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
            if (chance.bool())
                toReturn.push(chance.word()+this.HTML_tags[chance.integer({min: 0, max: this.HTML_tags.length})]);
            else
                toReturn.push(this.HTML_tags[chance.integer({min: 0, max: this.HTML_tags.length})]);
        }

        return toReturn;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //
    // Module specific methods and data
    //
    
    HTML_tags: [
        '<!--',
        '-->',
        '<!DOCTYPE>',
        '<a>',
        '<abbr>',
        '<acronym>',
        '<address>',
        '<applet> ',
        '<area> ',
        '<article>',
        '<aside>',
        '<audio>',
        '<b>',
        '<base>',
        '<basefont>',
        '<bdo>',
        '<big>',
        '<blockquote>',
        '<body>',
        '<br>',
        '<button>',
        '<canvas>',
        '<caption>',
        '<center>',
        '<cite> ',
        '<code>',
        '<col>',
        '<colgroup> ',
        '<command>',
        '<datalist>',
        '<dd>',
        '<del>',
        '<details>',
        '<dialog>',
        '<dfn>',
        '<dir>',
        '<div> ',
        '<dl>',
        '<dt>',
        '<em>',
        '<embed>',
        '<fieldset>',
        '<figure>',
        '<font>  ',
        '<footer> ',
        '<form>',
        '<frame>',
        '<frameset> ',
        '<h1>',
        '<h2>',
        '<h3>',
        '<h4>',
        '<h5>',
        '<h6>',
        '<head>',
        '<header>',
        '<hgroup> ',
        '<hr> ',
        '<html>',
        '<i> ',
        '<iframe> ',
        '<img> ',
        '<input>',
        '<ins>',
        '<keygen>',
        '<kbd> ',
        '<label> ',
        '<legend>',
        '<li> ',
        '<link> ',
        '<map> ',
        '<mark>',
        '<menu>',
        '<meta> ',
        '<meter>',
        '<nav>',
        '<noframes>',
        '<noscript>',
        '<object>',
        '<ol> ',
        '<optgroup> ',
        '<option> ',
        '<output>',
        '<p>',
        '<param>',
        '<pre>',
        '<progress>',
        '<q>',
        '<rp>',
        '<rt>',
        '<ruby>',
        '<s>',
        '<samp>', 
        '<script>', 
        '<section>', 
        '<select>',
        '<small>',
        '<source>',
        '<span>',
        '<strike>',
        '<strong>',
        '<style>',
        '<sub>',
        '<sup>',
        '<table>',
        '<tbody>',
        '<td>',
        '<textarea>',
        '<tfoot>',
        '<th>',
        '<thead>',
        '<time>',
        '<title>',
        '<tr>',
        '<tt>',
        '<u>',
        '<ul>',
        '<var>',
        '<video>',
        '<xmp>'
    ]

});

// ********************************************************************************************* //
// Registration

onmessage = function(e){
    HTMLGenModule.onMessage(e,HTMLGenModule);
};