Firestorm
=========

Firestorm is a fuzzing javascript fuzzing framework built on the top of Firebug.

It is still under heavy developpement so feel free to contribute by either testing, filling bug reports, or even contributing if you are interested in the project.

Features
--------

* Function mapping
    * Functions declarations `function test(alpha, beta)`
    * Functions variables `var test = function(alpha, beta)`
    * Object functions `var obj = { test: function propertyfunction(alpha, beta)}`
    
    * Nested functions
    
* Fuzzing capabilities
    * As of now, the fuzzer is capable of fuzzing functions producing objects that are compatible with structured
      cloning.
    * Generators can produce all kind of clonable data
    * Detectors take as input: HTML and function return after execution as well as a reference.
    * Report generation
    
Roadmap
-------

1. Fix some function use indexation issues
2. Remove dependency on transferable objects
3. Port to Firebug v3 when it comes out