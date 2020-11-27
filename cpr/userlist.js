var FirepadUserList = (function() {
    const SLIDER_OFFSET = 57;
    const USERDIV_WIDTH = 220;
    function FirepadUserList(ref, place, userId, displayName) {
      if (!(this instanceof FirepadUserList)) {
        return new FirepadUserList(ref, place, userId, displayName);
      }
  
      this.ref_ = ref;
      this.userId_ = userId;
      this.place_ = place;
      this.firebaseCallbacks_ = [];
  
      var self = this;
      this.hasName_ = !!displayName;
      this.displayName_ = displayName || 'Guest ' + Math.floor(Math.random() * 1000);
      this.firebaseOn_(ref.root.child('.info/connected'), 'value', function(s) {
        if (s.val() !== true) {
          wb_monaco.setActiveModel(null);
        }
        if (s.val() === true && self.displayName_) {
          var nameRef = ref.child(self.userId_).child('name');
          var userRef = ref.child(self.userId_);
          userRef.onDisconnect().remove();
          nameRef.set(self.displayName_);
          ref.child(self.userId_).child('color').set(colorFromUserId(self.userId_))
        }
      });
    }
    FirepadUserList.prototype.makeUserList = function(){
      var userlist_users = elt('div', [
        this.makeUserEntryForSelf_(),
        this.makeUserEntriesForOthers_()
      ], {'class': 'firepad-userlist-users' });
      
      var outer = elt('div', userlist_users, { 'class': 'firepad-userlist-users-outer'} );

      var scrollbar = wb_monaco.coderpair.makeUserScrollbar(outer,userlist_users);
        
      this.userList_= elt('div', [
        this.makeHeading_(),
        outer
      ], {'class': 'firepad-userlist' });
  
      //this.userList_.addEventListener("wheel", function(e){e.stopPropagation()}, {passive: false} );
      this.place_.appendChild(this.userList_);
      var close = elt('a', null, {'class': 'action-label codicon codicon-close firepad-userlist-close', 'role' : 'button','title':'close','tabindex':"0'"});
      this.place_.appendChild(close);
      $(".firepad-userlist-close").click(hideDialog)
      //scrollbar._scrollable.setScrollPositionNow({scrollLeft:107});
      //scrollbar._horizontalScrollbar._updateSlider2(57);
    }

    function hideDialog(){
      wb_monaco.coderpair.hideDialog()
    }
  
    // This is the primary "constructor" for symmetry with Firepad.
    FirepadUserList.fromDiv = FirepadUserList;
  
    FirepadUserList.prototype.dispose = function() {
      this.removeFirebaseCallbacks_();
      this.ref_.child(this.userId_).remove();
    
      this.place_.removeChild(this.userList_);
    };
  
    FirepadUserList.prototype.makeHeading_ = function() {
      var counterSpan = elt('span', '0');
      this.firebaseOn_(this.ref_, 'value', function(usersSnapshot) {
        setTextContent(counterSpan, "" + usersSnapshot.numChildren());
        wb_monaco.coderpair.setUserScrollbarDimensions(usersSnapshot.numChildren())
      });
  
      return elt('div', [
        elt('span', 'ONLINE ('),
        counterSpan,
        elt('span', ')')
      ], { 'class': 'firepad-userlist-heading' });
    };
  
    FirepadUserList.prototype.makeUserEntryForSelf_ = function() {
      var myUserRef = this.ref_.child(this.userId_);
  
      var colorDiv = elt('div', null, { 'class': 'firepad-userlist-color-indicator' });
      this.firebaseOn_(myUserRef.child('color'), 'value', function(colorSnapshot) {
        var color = colorSnapshot.val();
        if (isValidColor(color)) {
          colorDiv.style.backgroundColor = color;
        }
      });
  
      var nameInput = elt('input', null, { type: 'text', 'class': 'firepad-userlist-name-input'} );
      nameInput.value = this.displayName_;
  
      var nameHint = elt('div', 'ENTER YOUR NAME', { 'class': 'firepad-userlist-name-hint'} );
      if (this.hasName_) nameHint.style.display = 'none';
  
      // Update Firebase when name changes.
      var self = this;
      on(nameInput, 'change', function(e) {
        var name = nameInput.value || "Guest " + Math.floor(Math.random() * 1000);
        myUserRef.onDisconnect().remove();
        myUserRef.child('name').set(name);
        nameHint.style.display = 'none';
        nameInput.blur();
        self.displayName_ = name;
        stopEvent(e);
      });
  
      var nameDiv = elt('div', [nameInput, nameHint]);
  
      return elt('div', [ colorDiv, nameDiv ], {
        'class': 'firepad-userlist-user ' + 'firepad-user-' + this.userId_
      });
    };
  
    FirepadUserList.prototype.makeUserEntriesForOthers_ = function() {
      var self = this;
      var userList = elt('div');
      var userId2Element = { };
  
      function updateChild(userSnapshot, prevChildName) {
        var userId = userSnapshot.key;
        var div = userId2Element[userId];
        if (div) {
          userList.removeChild(div);
          delete userId2Element[userId];
        }
        var name = userSnapshot.child('name').val();
        if (typeof name !== 'string') { name = 'Guest'; }
        name = name.substring(0, 20);
  
        var color = userSnapshot.child('color').val();
        if (!isValidColor(color)) {
          color = "#ffb"
        }

        var path = userSnapshot.child('path').val() || '';
        if(path.length && path.charAt(path.length-1) == "/"){
          path = path.substr(0,path.length-1);
        }

        var pathLength = '5px';
        if (path != '') {
          pathLength = $.fn.textWidth(path, "12px 'Helvetica Neue', sans-serif")
        }

        var cursor = userSnapshot.child('cursor').val() || '';
        if(cursor != "")
          cursor = "ln: "+cursor.l+" col: "+cursor.c+"";
  
        var colorDiv = elt('div', null, { 'class': 'firepad-userlist-color-indicator' });
        colorDiv.style.backgroundColor = color;
  
        var nameDiv = elt('div', name || 'Guest', { 'class': 'firepad-userlist-name' });

        var lineDiv = elt('span', cursor, { 'class': 'firepad-user-line'} );

        nameDiv.appendChild(lineDiv);

        var pathDivInner = elt('div', path, { 'class': 'firepad-user-path-inner'} );
        
        //pathDivInner.addEventListener("wheel", function(e){e.stopPropagation()}, {passive: false} );
        
        pathDivInner.style.width = pathLength + 'px';
        
        var pathDiv = elt('div', [pathDivInner], { 'class': 'firepad-user-path'} );
        
        //pathDiv.addEventListener("wheel", function(e){e.stopPropagation()}, {passive: false} );

        pathDiv.style.width = Math.min(pathLength,USERDIV_WIDTH)+'px';

        var userDiv = elt('div', [ colorDiv, nameDiv,pathDiv], {
          'class': 'firepad-userlist-user ' + 'firepad-user-' + userId
        });

        var scrollbar = wb_monaco.coderpair.makePathScrollbar(pathDiv,pathDivInner)
        scrollbar.setScrollDimensions({width: USERDIV_WIDTH,scrollWidth:pathLength});
        userId2Element[userId] = userDiv;
  
        if (userId === self.userId_) {
          // HACK: We go ahead and insert ourself in the DOM, so we can easily order other users against it.
          // But don't show it.
          userDiv.style.display = 'none';
        }else{
          if(path)
            $(userDiv).click({path: path,cursor:cursor},openURI);
        }
  
        var nextElement =  prevChildName ? userId2Element[prevChildName].nextSibling : userList.firstChild;
        userList.insertBefore(userDiv, nextElement);
        scrollbar._scrollable.setScrollPositionNow({scrollLeft:2000});
		    scrollbar._horizontalScrollbar._updateSlider2(SLIDER_OFFSET);
      }
  
      this.firebaseOn_(this.ref_, 'child_added', updateChild);
      this.firebaseOn_(this.ref_, 'child_changed', updateChild);
      this.firebaseOn_(this.ref_, 'child_moved', updateChild);
      this.firebaseOn_(this.ref_, 'child_removed', function(removedSnapshot) {
        var userId = removedSnapshot.key;
        var div = userId2Element[userId];
        if (div) {
          userList.removeChild(div);
          delete userId2Element[userId];
        }
      });
      return userList;
    };

    function openURI(event) {
        if (!$(event.target).hasClass('scrollbar horizontal')) {
          wb_monaco.coderpair.openURI(event.data.path,event.data.cursor)
        }
    };
  
    FirepadUserList.prototype.firebaseOn_ = function(ref, eventType, callback, context) {
      this.firebaseCallbacks_.push({ref: ref, eventType: eventType, callback: callback, context: context });
      ref.on(eventType, callback, context);
      return callback;
    };
  
    FirepadUserList.prototype.firebaseOff_ = function(ref, eventType, callback, context) {
      ref.off(eventType, callback, context);
      for(var i = 0; i < this.firebaseCallbacks_.length; i++) {
        var l = this.firebaseCallbacks_[i];
        if (l.ref === ref && l.eventType === eventType && l.callback === callback && l.context === context) {
          this.firebaseCallbacks_.splice(i, 1);
          break;
        }
      }
    };
  
    FirepadUserList.prototype.removeFirebaseCallbacks_ = function() {
      for(var i = 0; i < this.firebaseCallbacks_.length; i++) {
        var l = this.firebaseCallbacks_[i];
        l.ref.off(l.eventType, l.callback, l.context);
      }
      this.firebaseCallbacks_ = [];
    };
  
    /** Assorted helpers */
  
    function isValidColor(color) {
      return typeof color === 'string' &&
        (color.match(/^#[a-fA-F0-9]{3,6}$/) || color == 'transparent');
    }


    $.fn.textWidth = function(text, font) {
      if (!$.fn.textWidth.fakeEl) $.fn.textWidth.fakeEl = $('<span>').hide().appendTo(document.body);
      $.fn.textWidth.fakeEl.text(text || this.val() || this.text()).css('font', font || this.css('font'));
      return Math.round($.fn.textWidth.fakeEl.width())+5;
    };

    function colorFromUserId (userId) {
      var a = 1;
      for (var i = 0; i < userId.length; i++) {
        a = 17 * (a+userId.charCodeAt(i)) % 360;
      }
      var hue = a/360;
  
      return hsl2hex(hue, .5, 0.35);
    }
  
    function rgb2hex (r, g, b) {
      function digits (n) {
        var m = Math.round(255*n).toString(16);
        return m.length === 1 ? '0'+m : m;
      }
      return '#' + digits(r) + digits(g) + digits(b);
    }
  
    function hsl2hex (h, s, l) {
      if (s === 0) { return rgb2hex(l, l, l); }
      var var2 = l < 0.5 ? l * (1+s) : (l+s) - (s*l);
      var var1 = 2 * l - var2;
      var hue2rgb = function (hue) {
        if (hue < 0) { hue += 1; }
        if (hue > 1) { hue -= 1; }
        if (6*hue < 1) { return var1 + (var2-var1)*6*hue; }
        if (2*hue < 1) { return var2; }
        if (3*hue < 2) { return var1 + (var2-var1)*6*(2/3 - hue); }
        return var1;
      };
      return rgb2hex(hue2rgb(h+1/3), hue2rgb(h), hue2rgb(h-1/3));
    }
  
  
    /** DOM helpers */
    function elt(tag, content, attrs) {
      var e = document.createElement(tag);
      if (typeof content === "string") {
        setTextContent(e, content);
      } else if (content) {
        for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]); }
      }
      for(var attr in (attrs || { })) {
        e.setAttribute(attr, attrs[attr]);
      }
      return e;
    }
  
    function setTextContent(e, str) {
      e.innerHTML = "";
      e.appendChild(document.createTextNode(str));
    }
  
    function on(emitter, type, f) {
      if (emitter.addEventListener) {
        emitter.addEventListener(type, f, false);
      } else if (emitter.attachEvent) {
        emitter.attachEvent("on" + type, f);
      }
    }
  
    function off(emitter, type, f) {
      if (emitter.removeEventListener) {
        emitter.removeEventListener(type, f, false);
      } else if (emitter.detachEvent) {
        emitter.detachEvent("on" + type, f);
      }
    }
  
    function preventDefault(e) {
      if (e.preventDefault) {
        e.preventDefault();
      } else {
        e.returnValue = false;
      }
    }
  
    function stopPropagation(e) {
      if (e.stopPropagation) {
        e.stopPropagation();
      } else {
        e.cancelBubble = true;
      }
    }
  
    function stopEvent(e) {
      preventDefault(e);
      stopPropagation(e);
    }
  
    return FirepadUserList;
  })();
  






