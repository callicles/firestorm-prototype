
/* Message relay */
window.addEventListener('message', function(event) {
    self.port.emit('data', event.data)
}, false);

/* Serialization for context data */
function censor(key,value){  
    if (this[key] === this || value === null)
        return undefined
    if (typeof this[key] === 'function')
        return value.toString();
    if (this[key] instanceof HTMLCollection){
        console.log("In HTML Collection");
        var list = [];
        for (var i = 0 ; i < value.length; i++){
            list.push(JSON.parse(JSON.stringify(value[i], censor, '\t')))
        }
        console.log("In HTML Collection");
        return list;
    }
    if (this[key] instanceof Element){

        return {"tagName": value.tagName, "children": JSON.parse(JSON.stringify(value.children,censor,'\t'))};
    }

    return value
}
exportFunction(censor, unsafeWindow, {defineAs: "censor"});