// Copyright (C) Robert Beach. All rights reserved.
// Coderpair Firepad Integration

(function(){
    // resourceMap  maps resource to firepadMap
    // firepadMap maps instance identifier to firepad instance
    resourceMap = new Map();

    var activeModel;
        
    wb_monaco.currentGroup = 0;
    
    wb_monaco.modelsMap = new Map();
    wb_monaco.suppressSave = false;
    wb_monaco.suppressTriggerDiff = false;
    wb_monaco.autoSaveDelay = 200;
    wb_monaco.timeout1 = null;

    wb_monaco.setRange = function (range) {
        if(!monaco.Range)
            monaco.Range = range;
    };

    /*
    *  connectEditorToFirepad
    *
    *  editor: ICodeEditor  (The monaco editor)
    *  resource: string (The location of the resource)
    *  instanceID: string (Identifies a unique instance of an open resource)
    *  options: object (optional parameters)
    *
    */
    wb_monaco.connectEditorToFirepad = function (editor, resource, instanceID, options) {
        log1("in connectEditorToFirepad: " + editor._id + ' ' + resource.path + ' ' + instanceID);
        if (wb_monaco.disabled || resource.scheme=='untitled') return;
        var model = editor.getModel();
        if (model) {
            log2("has model");
            if (!wb_monaco.modelsMap.has(model)) {
                log2("setting model");
                wb_monaco.modelsMap.set(model,new Map());
            };
            var firepadMap = wb_monaco.modelsMap.get(model);
            wb_monaco.goToRange=null;
            if (!firepadMap.has(editor._id)) {
                log2("firepadMap has editor id");
                firepadMap.set(editor._id, null);
                wb_monaco.suppressSave = true;
                if(options && options.diff_original){
                    wb_monaco.suppressTriggerDiff = true;
                }
                var value = model.getValue();
                model.instanceId = instanceID;
                log2('mtoi '+moreThanOneInstance(model));
                var mtoi = moreThanOneInstance(model);
                if(!mtoi)model.setValue('');
                wb_monaco.suppressTriggerDiff = false;
                wb_monaco.suppressSave = false;
                initFirepad(model, editor, resource, value, mtoi)
            }
        }
    };

    function initFirepad(model, editor, resource, value, mtoi) {
        var path = model.uri.path.replace(/\./gi, "_");
        log2("initFirepad path: " + path);
        var ref = firebase.database().ref();
        var fileref = ref.child(wb_monaco.firepad_ref.childref + "/files" + path);

        // Create a data file indicator for the path, if it does not exist
        var dataref = ref.child(wb_monaco.firepad_ref.childref + "/data" + path);
        var usrref = ref.child('users/' + wb_monaco.user);
        dataref.transaction(function (currentData) {
            if (currentData === null || currentData === 1) {
                return 1;
            } else {
                log2('File ready');
                return; // Abort the transaction.
            }
        }, function (error, committed, snapshot) {
            var readyState = 0;
            if (error) {
                log2('Transaction I failed abnormally!', error);
            } else if (!committed) {
                readyState = 2;
                log2('We aborted the transaction (because file exists).');
            } else {
                log2('File pending');
                readyState = 1;
            }
            if (readyState != 0) {
                if (readyState == 1) {
                    fileref.child('history').orderByKey().limitToLast(1).once("value").then(function(snapshot) {
                        var characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
                        function revisionToId(revision) {
                            if (revision === 0) {
                            return 'A0';
                            }
        
                            var str = '';
                            while (revision > 0) {
                            var digit = (revision % characters.length);
                            str = characters[digit] + str;
                            revision -= digit;
                            revision /= characters.length;
                            }
        
                            // Prefix with length (starting at 'A' for length 1) to ensure the id's sort lexicographically.
                            var prefix = characters[str.length + 9];
                            return prefix + str;
                        }
        
                        function revisionFromId(revisionId) {
                            
                            var revision = 0;
                            for(var i = 1; i < revisionId.length; i++) {
                            revision *= characters.length;
                            revision += characters.indexOf(revisionId[i]);
                            }
                            return revision;
                        }

                        var key = "A0";
                        var rev = snapshot.val();
                        if(rev){
                            key = Object.keys(rev)[0];
                            var id = revisionFromId(key);
                            id++;
                            key = revisionToId(id);
                            fileref.child('history').child(key).transaction(function (currentData) {
                                if (currentData === null){
                                    log2('First entry');
                                    return {
                                            "a": "-MD3FwTopQvGVUeAtriv", // Random dummy user
                                            "o": [value,true],
                                            "t": firebase.database.ServerValue.TIMESTAMP
                                        };
                                }else{
                                    return;
                                }
                            }, function (error, committed, snapshot) {
                                if (error) {
                                    log2('Transaction II failed abnormally!', error);
                                } else {
                                    log2('File OK');
                                    dataref.set(2);
                                    document.activeElement.blur();
                                    var firepad = Firepad.fromMonaco(fileref, editor, {userId: wb_monaco.user}, mtoi,dataref,usrref);
                                    wb_monaco.modelsMap.get(model).set(editor._id,firepad);
                                    firepad.on('ready', function () {
                                        // Firepad is ready.
                                        setRange();
                                    });
                                }
                            });
                        }else{
                            fileref.transaction(function (currentData) {
                                if (currentData === null){
                                    log2('First entry');
                                    return {
                                        "history": {
                                            "A0": {
                                                "a": "-MD3FwTopQvGVUeAtriv", // Random dummy user
                                                "o": [value],
                                                "t": firebase.database.ServerValue.TIMESTAMP
                                            }
                                        }
                                    };
                                    
                                }else{
                                    return;
                                }
                                }, function (error, committed, snapshot) {
                                if (error) {
                                    log2('Transaction II failed abnormally!', error);
                                } else {
                                    log2('File OK');
                                    dataref.set(2);
                                    document.activeElement.blur();
                                    var firepad = Firepad.fromMonaco(fileref, editor, {userId: wb_monaco.user}, mtoi,dataref,usrref);
                                    wb_monaco.modelsMap.get(model).set(editor._id,firepad);
                                    firepad.on('ready', function () {
                                        // Firepad is ready.
                                        setRange();
                                    });
                                }
                            });
                        }
                    });
                } else {
                    document.activeElement.blur();
                    var firepad = Firepad.fromMonaco(fileref, editor, {userId: wb_monaco.user}, mtoi,dataref,usrref);
                    wb_monaco.modelsMap.get(model).set(editor._id,firepad);
                    firepad.on('ready', function () {
                        // Firepad is ready.
                        setRange();
                    });
                }
            }
        });
    };

    function setRange(){
        if(wb_monaco.goToRange){
            wb_monaco.goToRange.editor.revealRangeInCenter(wb_monaco.goToRange.range)
        }
        wb_monaco.goToRange=null;
    };

    function moreThanOneInstance(model){
        return (wb_monaco.modelsMap.get(model)).size>1;
    };

    wb_monaco.setActiveModel =  function(model){
        if(wb_monaco.disabled)return;
        if(!model){
            if(activeModel){
                clearTimeout(wb_monaco.timeout1);
                wb_monaco.timeout1 = setTimeout(wb_monaco.writePathRef,200)
            }
            activeModel = null;
            return;
        }
        var same = false;
        if(activeModel){
            if(activeModel.uri.path == model.uri.path){
                same = true;
            }
        }
        activeModel = model;
        if(!same){
            clearTimeout(wb_monaco.timeout1);
            wb_monaco.timeout1 = setTimeout(wb_monaco.writePathRef,200)
        }
    };

    wb_monaco.writePathRef = function(){
       if(activeModel){
            firebase.database().ref('users/' + wb_monaco.user).child("path").set(activeModel.uri.path);
       }else{
            firebase.database().ref('users/' + wb_monaco.user).child("path").remove();
       }
       firebase.database().ref('users/' + wb_monaco.user).child("cursor").remove();
    }
        
    wb_monaco.destroyFirepad = function(model){
        log2("in destroy firepad");
        if(wb_monaco.disabled)
            return;
        var firepadMap=wb_monaco.modelsMap.get(model);
        if(firepadMap){
            for (let fp of firepadMap.values()) {
                fp.destroy();
            }
            wb_monaco.modelsMap.delete(model);
            log2("Firepad: delete model from map");
        }
    };

    wb_monaco.attachFirepad = function(model,id){
        log2("in attachFirepad");
        if(isDebug && isDebug2)console.trace();
        if(wb_monaco.disabled)
            return;
        var firepadMap=wb_monaco.modelsMap.get(model);
        if(firepadMap){
            var firepad=firepadMap.get(id);
            if(firepad){
                firepad.reattach();
                firebase.database().ref('users/' + wb_monaco.user).child("path").set(model.uri.path);
                log2("Firepad: reattach instance: " + model.uri)
            }
        }
    };

    wb_monaco.detachFirepad = function(model,id){
        log2("in detachFirepad");
        if(wb_monaco.disabled)
            return;
        var firepadMap=wb_monaco.modelsMap.get(model);
        if(firepadMap){
            var firepad=firepadMap.get(id);
            if(firepad){
                firepad.detach();
                log2("Firepad: detach but don't delete: " + model.uri)
            }
        }
    };

    wb_monaco.hasPreviousModelData = function(model,id){
        log2("in hasPreviousModelData");
        if(wb_monaco.disabled)
            return;
        var firepadMap=wb_monaco.modelsMap.get(model);
        if(firepadMap){
            var firepad=firepadMap.get(id);
            if(firepad){
                return true;
            }
        }
        return false;
    };

    wb_monaco.getPreviousModelData = function(model,id){
        log2("in getPreviousModelData");
        if(wb_monaco.disabled)
            return;
        var firepadMap=wb_monaco.modelsMap.get(model);
        if(firepadMap){
            var firepad=firepadMap.get(id);
            if(firepad){
                return firepad.getModelData();
            }
        }
    };

    wb_monaco.invalidate = async function(p){
        log2("in invalidate: " + p);
        if(wb_monaco.disabled)
            return Promise.resolve(true);
        var ref = firebase.database().ref();
        var path = p.replace(/\./gi, "_");
        var fileref = ref.child(wb_monaco.firepad_ref.childref + "/files" + path);
        var dataref = ref.child(wb_monaco.firepad_ref.childref + "/data" + path);
        log2("invalidate path: " + path);
        await dataref.remove()
        .then(function () {
            log2('Remove done');
        })
        .catch(function(error) {
            log2("Remove failed: " + error.message)
            resolve(false);
        });
        return Promise.resolve(true)
    };

    wb_monaco.isInvalid = function(p){
        if(wb_monaco.disabled)
            return Promise.resolve(false);
        var ref = firebase.database().ref();
        var path = p.replace(/\./gi, "_");
        var dataref = ref.child(wb_monaco.firepad_ref.childref + "/data" + path);
        
        return new Promise(resolve => {
            dataref.once('value').then(function(snapshot) {
                if(snapshot.val()==null){
                    resolve(true);
                }else{
                    resolve(false);
                }
            });
        });
    }
}());
