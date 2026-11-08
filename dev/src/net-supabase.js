window.makeSupabaseRoom=function(cfg){
  var client=null;
  function getClient(){if(!client)client=window.supabase.createClient(cfg.url,cfg.key);return client}
  var myKey=Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,6);
  return {
    join:function(name){
      var ch=null;
      var myPres={},peers=new Map(),peerFns=[],connFns=[];
      var connected=false,subscribed=false,left=false;
      var sendTimer=null,lastSend=0,hbTimer=null,sweepTimer=null,notifyQueued=false;
      function rawSend(event,payload){
        try{var r=ch.send({type:'broadcast',event:event,payload:payload});if(r&&r.catch)r.catch(function(){})}catch(e){}
      }
      function sendNow(){
        if(sendTimer){clearTimeout(sendTimer);sendTimer=null}
        lastSend=Date.now();
        rawSend('p',{k:myKey,p:myPres});
      }
      function sendSoon(){
        if(sendTimer)return;
        var wait=Math.max(0,150-(Date.now()-lastSend));
        sendTimer=setTimeout(function(){sendTimer=null;sendNow()},wait);
      }
      function snapshot(){
        var list=[];
        peers.forEach(function(v,k){list.push({peer:k,presence:v.presence,updatedAt:v.updatedAt,isMe:false,sameTab:false})});
        list.push({peer:myKey,presence:myPres,updatedAt:Date.now(),isMe:true,sameTab:true});
        return {peers:list};
      }
      function notifyPeers(){
        if(notifyQueued)return;notifyQueued=true;
        queueMicrotask(function(){
          notifyQueued=false;
          peerFns.slice().forEach(function(f){try{f(snapshot())}catch(e){}});
        });
      }
      function notifyConn(){connFns.slice().forEach(function(f){try{f(connected)}catch(e){}})}
      function startTimers(){
        if(!hbTimer)hbTimer=setInterval(function(){if(subscribed)sendNow()},3000);
        if(!sweepTimer)sweepTimer=setInterval(function(){
          var now=Date.now(),dropped=false;
          Array.from(peers.keys()).forEach(function(k){if(now-peers.get(k).lastHeard>10000){peers.delete(k);dropped=true}});
          if(dropped)notifyPeers();
        },2000);
      }
      function setup(){
        ch=getClient().channel('hl-'+name,{config:{broadcast:{self:false}}});
        ch.on('broadcast',{event:'p'},function(m){
          var pl=m&&m.payload;if(!pl||pl.k===myKey)return;
          var cur=peers.get(pl.k),now=Date.now();
          var p=pl.p||{};
          if(!cur)peers.set(pl.k,{presence:p,updatedAt:now,lastHeard:now});
          else{
            if(JSON.stringify(cur.presence)!==JSON.stringify(p)){cur.presence=p;cur.updatedAt=now}
            cur.lastHeard=now;
          }
          notifyPeers();
        });
        ch.on('broadcast',{event:'hello'},function(m){
          var pl=m&&m.payload;if(!pl||pl.k===myKey)return;
          sendNow();
        });
        ch.on('broadcast',{event:'bye'},function(m){
          var pl=m&&m.payload;if(!pl||pl.k===myKey)return;
          if(peers.delete(pl.k))notifyPeers();
        });
        var mine=ch;
        ch.subscribe(function(status){
          if(left||mine!==ch)return;
          if(status==='SUBSCRIBED'){
            connected=true;subscribed=true;notifyConn();
            rawSend('hello',{k:myKey});
            sendNow();
            startTimers();
          }else if(status==='CLOSED'||status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
            connected=false;subscribed=false;notifyConn();
          }
        });
      }
      setup();
      return Promise.resolve({
        presence:function(patch){
          try{
            for(var k in patch){if(patch[k]===null)delete myPres[k];else myPres[k]=patch[k]}
            sendSoon();notifyPeers();
          }catch(e){}
          return Promise.resolve();
        },
        onPeers:function(fn){
          peerFns.push(fn);
          setTimeout(function(){try{fn(snapshot())}catch(e){}},0);
          return function(){var i=peerFns.indexOf(fn);if(i>=0)peerFns.splice(i,1)};
        },
        onConnection:function(fn){
          connFns.push(fn);
          setTimeout(function(){try{fn(connected)}catch(e){}},0);
          return function(){var i=connFns.indexOf(fn);if(i>=0)connFns.splice(i,1)};
        },
        connected:function(){return connected},
        reconnect:function(){
          if(connected||left)return;
          try{var r=getClient().removeChannel(ch);if(r&&r.catch)r.catch(function(){})}catch(e){}
          subscribed=false;
          setup();
        },
        leave:function(){
          left=true;
          rawSend('bye',{k:myKey});
          if(sendTimer){clearTimeout(sendTimer);sendTimer=null}
          clearInterval(hbTimer);clearInterval(sweepTimer);hbTimer=sweepTimer=null;
          connected=false;subscribed=false;
          try{var r=getClient().removeChannel(ch);if(r&&r.catch)r.catch(function(){})}catch(e){}
          return Promise.resolve();
        }
      });
    }
  };
};
