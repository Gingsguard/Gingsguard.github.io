// build time:Wed Jan 15 2020 15:52:46 GMT+0800 (GMT+08:00)
!function(r){var t={};function e(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return r[n].call(o.exports,o,o.exports,e),o.l=!0,o.exports}e.m=r,e.c=t,e.d=function(r,t,n){e.o(r,t)||Object.defineProperty(r,t,{configurable:!1,enumerable:!0,get:n})},e.n=function(r){var t=r&&r.__esModule?function(){return r.default}:function(){return r};return e.d(t,"a",t),t},e.o=function(r,t){return Object.prototype.hasOwnProperty.call(r,t)},e.p="",e(e.s=18)}({18:function(r,t,e){"use strict";var n,o,i,a,u,f,c=(n=e(19))&&n.__esModule?n:{"default":n};function g(r,t){var e=r.replace(/<%-sURL%>/g,encodeURIComponent(t.sURL)).replace(/<%-sTitle%>/g,t.sTitle).replace(/<%-sDesc%>/g,t.sDesc).replace(/<%-sAuthor%>/g,t.sAuthor).replace(/<%-sImg%>/g,encodeURIComponent(t.sImg));window.open(e)}o=window.location.href,i=document.querySelector("title").innerHTML,a=document.querySelector(".article-entry img")&&document.querySelector(".article-entry img").getAttribute("src"),u={sURL:o,sTitle:i,sImg:a=window.location.protocol+"//"+window.location.hostname+(window.location.port?":"+window.location.port:"")+a,sDesc:document.querySelector(".article-entry")&&document.querySelector(".article-entry").innerText.substring(0,30)+"...",sAuthor:window.siteMeta.author},(f=document.querySelector(".shareList"))&&(function(r){var t=(0,c.default)(0,"L");t.addData(r),t.make(),document.getElementsByClassName("share-qrcode")[0].innerHTML=t.createImgTag()}(o),f.addEventListener("click",function(r){r.target.getAttribute("data-type")&&function(r,t){"weibo"===r?g("http://service.weibo.com/share/share.php?url=<%-sURL%>&title=<%-sTitle%>&pic=<%-sImg%>",t):"qzone"===r?g("http://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=<%-sURL%>&title=<%-sTitle%>&pics=<%-sImg%>&summary=<%-sDesc%>",t):"facebook"===r?g("https://www.facebook.com/sharer/sharer.php?u=<%-sURL%>",t):"twitter"===r&&g("https://twitter.com/intent/tweet?text=<%-sTitle%>&url=<%-sURL%>&via=<%-sAuthor%>",t)}(r.target.getAttribute("data-type"),u)}))},19:function(r,t,e){var n,o,i,a=function(){var r=function(r,t){var e=r,n=f[t],o=null,i=0,a=null,u=new Array,c={},g=function(r,t){o=function(r){for(var t=new Array(r),e=0;e<r;e+=1){t[e]=new Array(r);for(var n=0;n<r;n+=1)t[e][n]=null}return t}(i=4*e+17),s(0,0),s(i-7,0),s(0,i-7),l(),h(),v(r,t),e>=7&&w(r),null==a&&(a=y(e,n,u)),d(a,t)},s=function(r,t){for(var e=-1;e<=7;e+=1)if(!(r+e<=-1||i<=r+e))for(var n=-1;n<=7;n+=1)t+n<=-1||i<=t+n||(o[r+e][t+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var r=8;r<i-8;r+=1)null==o[r][6]&&(o[r][6]=r%2==0);for(var t=8;t<i-8;t+=1)null==o[6][t]&&(o[6][t]=t%2==0)},l=function(){for(var r=p.getPatternPosition(e),t=0;t<r.length;t+=1)for(var n=0;n<r.length;n+=1){var i=r[t],a=r[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},w=function(r){for(var t=p.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!r&&1==(t>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!r&&1==(t>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},v=function(r,t){for(var e=n<<3|t,a=p.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!r&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!r&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!r},d=function(r,t){for(var e=-1,n=i-1,a=7,u=0,f=p.getMaskFunction(t),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var s=!1;u<r.length&&(s=1==(r[u]>>>a&1)),f(n,c-g)&&(s=!s),o[n][c-g]=s,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},y=function(r,t,e){for(var n=B.getRSBlocks(r,t),o=A(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),p.getLengthInBits(a.getMode(),r)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw new Error("code length overflow. ("+o.getLengthInBits()+">"+8*u+")");for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(r,t){for(var e=0,n=0,o=0,i=new Array(t.length),a=new Array(t.length),u=0;u<t.length;u+=1){var f=t[u].dataCount,c=t[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&r.getBuffer()[g+e];e+=f;var s=p.getErrorCorrectPolynomial(c),h=m(i[u],s.getLength()-1).mod(s);for(a[u]=new Array(s.getLength()-1),g=0;g<a[u].length;g+=1){var l=g+h.getLength()-a[u].length;a[u][g]=l>=0?h.getAt(l):0}}var w=0;for(g=0;g<t.length;g+=1)w+=t[g].totalCount;var v=new Array(w),d=0;for(g=0;g<n;g+=1)for(u=0;u<t.length;u+=1)g<i[u].length&&(v[d]=i[u][g],d+=1);for(g=0;g<o;g+=1)for(u=0;u<t.length;u+=1)g<a[u].length&&(v[d]=a[u][g],d+=1);return v}(o,n)};return c.addData=function(r,t){var e=null;switch(t=t||"Byte"){case"Numeric":e=C(r);break;case"Alphanumeric":e=k(r);break;case"Byte":e=L(r);break;case"Kanji":e=b(r);break;default:throw"mode:"+t}u.push(e),a=null},c.isDark=function(r,t){if(r<0||i<=r||t<0||i<=t)throw new Error(r+","+t);return o[r][t]},c.getModuleCount=function(){return i},c.make=function(){if(e<1){for(var r=1;r<40;r++){for(var t=B.getRSBlocks(r,n),o=A(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),p.getLengthInBits(a.getMode(),r)),a.write(o)}var f=0;for(i=0;i<t.length;i++)f+=t[i].dataCount;if(o.getLengthInBits()<=8*f)break}e=r}g(!1,function(){for(var r=0,t=0,e=0;e<8;e+=1){g(!0,e);var n=p.getLostPoint(c);(0==e||r>n)&&(r=n,t=e)}return t}())},c.createTableTag=function(r,t){r=r||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(t=void 0===t?4*r:t)+"px;",e+='">',e+="<tbody>";for(var n=0;n<c.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<c.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+r+"px;",e+=" height: "+r+"px;",e+=" background-color: ",e+=c.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},c.createSvgTag=function(r,t){r=r||2,t=void 0===t?4*r:t;var e,n,o,i,a=c.getModuleCount()*r+2*t,u="";for(i="l"+r+",0 0,"+r+" -"+r+",0 0,-"+r+"z ",u+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',u+=' width="'+a+'px"',u+=' height="'+a+'px"',u+=' viewBox="0 0 '+a+" "+a+'" ',u+=' preserveAspectRatio="xMinYMin meet">',u+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',u+='<path d="',n=0;n<c.getModuleCount();n+=1)for(o=n*r+t,e=0;e<c.getModuleCount();e+=1)c.isDark(n,e)&&(u+="M"+(e*r+t)+","+o+i);return u+='" stroke="transparent" fill="black"/>',u+="</svg>"},c.createImgTag=function(r,t){r=r||2,t=void 0===t?4*r:t;var e=c.getModuleCount()*r+2*t,n=t,o=e-t;return D(e,e,function(t,e){if(n<=t&&t<o&&n<=e&&e<o){var i=Math.floor((t-n)/r),a=Math.floor((e-n)/r);return c.isDark(a,i)?0:1}return 1})},c};r.stringToBytes=(r.stringToBytesFuncs={"default":function(r){for(var t=[],e=0;e<r.length;e+=1){var n=r.charCodeAt(e);t.push(255&n)}return t}}).default,r.createStringToBytes=function(r,t){var e=function(){for(var e=x(r),n=function(){var r=e.read();if(-1==r)throw new Error;return r},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=t)throw new Error(o+" != "+t);return i}(),n="?".charCodeAt(0);return function(r){for(var t=new Array,o=0;o<r.length;o+=1){var i=r.charCodeAt(o);if(i<128)t.push(i);else{var a=e[r.charAt(o)];"number"==typeof a?(255&a)==a?t.push(a):(t.push(a>>>8),t.push(255&a)):t.push(n)}}return t}};var t,e,n,o=1,i=2,a=4,u=8,f={L:1,M:0,Q:3,H:2},c=0,g=1,s=2,h=3,l=4,w=5,v=6,d=7,p=(t=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],n=function(r){for(var t=0;0!=r;)t+=1,r>>>=1;return t},(e={}).getBCHTypeInfo=function(r){for(var t=r<<10;n(t)-n(1335)>=0;)t^=1335<<n(t)-n(1335);return 21522^(r<<10|t)},e.getBCHTypeNumber=function(r){for(var t=r<<12;n(t)-n(7973)>=0;)t^=7973<<n(t)-n(7973);return r<<12|t},e.getPatternPosition=function(r){return t[r-1]},e.getMaskFunction=function(r){switch(r){case c:return function(r,t){return(r+t)%2==0};case g:return function(r,t){return r%2==0};case s:return function(r,t){return t%3==0};case h:return function(r,t){return(r+t)%3==0};case l:return function(r,t){return(Math.floor(r/2)+Math.floor(t/3))%2==0};case w:return function(r,t){return r*t%2+r*t%3==0};case v:return function(r,t){return(r*t%2+r*t%3)%2==0};case d:return function(r,t){return(r*t%3+(r+t)%2)%2==0};default:throw new Error("bad maskPattern:"+r)}},e.getErrorCorrectPolynomial=function(r){for(var t=m([1],0),e=0;e<r;e+=1)t=t.multiply(m([1,y.gexp(e)],0));return t},e.getLengthInBits=function(r,t){if(1<=t&&t<10)switch(r){case o:return 10;case i:return 9;case a:case u:return 8;default:throw new Error("mode:"+r)}else if(t<27)switch(r){case o:return 12;case i:return 11;case a:return 16;case u:return 10;default:throw new Error("mode:"+r)}else{if(!(t<41))throw new Error("type:"+t);switch(r){case o:return 14;case i:return 13;case a:return 16;case u:return 12;default:throw new Error("mode:"+r)}}},e.getLostPoint=function(r){for(var t=r.getModuleCount(),e=0,n=0;n<t;n+=1)for(var o=0;o<t;o+=1){for(var i=0,a=r.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||t<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||t<=o+f||0==u&&0==f||a==r.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<t-1;n+=1)for(o=0;o<t-1;o+=1){var c=0;r.isDark(n,o)&&(c+=1),r.isDark(n+1,o)&&(c+=1),r.isDark(n,o+1)&&(c+=1),r.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<t;n+=1)for(o=0;o<t-6;o+=1)r.isDark(n,o)&&!r.isDark(n,o+1)&&r.isDark(n,o+2)&&r.isDark(n,o+3)&&r.isDark(n,o+4)&&!r.isDark(n,o+5)&&r.isDark(n,o+6)&&(e+=40);for(o=0;o<t;o+=1)for(n=0;n<t-6;n+=1)r.isDark(n,o)&&!r.isDark(n+1,o)&&r.isDark(n+2,o)&&r.isDark(n+3,o)&&r.isDark(n+4,o)&&!r.isDark(n+5,o)&&r.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<t;o+=1)for(n=0;n<t;n+=1)r.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/t/t-50)/5*10},e),y=function(){for(var r=new Array(256),t=new Array(256),e=0;e<8;e+=1)r[e]=1<<e;for(e=8;e<256;e+=1)r[e]=r[e-4]^r[e-5]^r[e-6]^r[e-8];for(e=0;e<255;e+=1)t[r[e]]=e;var n={glog:function(r){if(r<1)throw new Error("glog("+r+")");return t[r]},gexp:function(t){for(;t<0;)t+=255;for(;t>=256;)t-=255;return r[t]}};return n}();function m(r,t){if(void 0===r.length)throw new Error(r.length+"/"+t);var e=function(){for(var e=0;e<r.length&&0==r[e];)e+=1;for(var n=new Array(r.length-e+t),o=0;o<r.length-e;o+=1)n[o]=r[o+e];return n}(),n={getAt:function(r){return e[r]},getLength:function(){return e.length},multiply:function(r){for(var t=new Array(n.getLength()+r.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<r.getLength();o+=1)t[e+o]^=y.gexp(y.glog(n.getAt(e))+y.glog(r.getAt(o)));return m(t,0)},mod:function(r){if(n.getLength()-r.getLength()<0)return n;for(var t=y.glog(n.getAt(0))-y.glog(r.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<r.getLength();o+=1)e[o]^=y.gexp(y.glog(r.getAt(o))+t);return m(e,0).mod(r)}};return n}var B=function(){var r=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],t=function(r,t){var e={};return e.totalCount=r,e.dataCount=t,e},e={};return e.getRSBlocks=function(e,n){var o=function(t,e){switch(e){case f.L:return r[4*(t-1)+0];case f.M:return r[4*(t-1)+1];case f.Q:return r[4*(t-1)+2];case f.H:return r[4*(t-1)+3];default:return}}(e,n);if(void 0===o)throw new Error("bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n);for(var i=o.length/3,a=new Array,u=0;u<i;u+=1)for(var c=o[3*u+0],g=o[3*u+1],s=o[3*u+2],h=0;h<c;h+=1)a.push(t(g,s));return a},e}(),A=function(){var r=new Array,t=0,e={getBuffer:function(){return r},getAt:function(t){var e=Math.floor(t/8);return 1==(r[e]>>>7-t%8&1)},put:function(r,t){for(var n=0;n<t;n+=1)e.putBit(1==(r>>>t-n-1&1))},getLengthInBits:function(){return t},putBit:function(e){var n=Math.floor(t/8);r.length<=n&&r.push(0),e&&(r[n]|=128>>>t%8),t+=1}};return e},C=function(r){var t=o,e=r,n={getMode:function(){return t},getLength:function(r){return e.length},write:function(r){for(var t=e,n=0;n+2<t.length;)r.put(i(t.substring(n,n+3)),10),n+=3;n<t.length&&(t.length-n==1?r.put(i(t.substring(n,n+1)),4):t.length-n==2&&r.put(i(t.substring(n,n+2)),7))}},i=function(r){for(var t=0,e=0;e<r.length;e+=1)t=10*t+a(r.charAt(e));return t},a=function(r){if("0"<=r&&r<="9")return r.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+r};return n},k=function(r){var t=i,e=r,n={getMode:function(){return t},getLength:function(r){return e.length},write:function(r){for(var t=e,n=0;n+1<t.length;)r.put(45*o(t.charAt(n))+o(t.charAt(n+1)),11),n+=2;n<t.length&&r.put(o(t.charAt(n)),6)}},o=function(r){if("0"<=r&&r<="9")return r.charCodeAt(0)-"0".charCodeAt(0);if("A"<=r&&r<="Z")return r.charCodeAt(0)-"A".charCodeAt(0)+10;switch(r){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+r}};return n},L=function(t){var e=a,n=r.stringToBytes(t),o={getMode:function(){return e},getLength:function(r){return n.length},write:function(r){for(var t=0;t<n.length;t+=1)r.put(n[t],8)}};return o},b=function(t){var e=u,n=r.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(r,t){var e=n("友");if(2!=e.length||38726!=(e[0]<<8|e[1]))throw"sjis not supported."}();var o=n(t),i={getMode:function(){return e},getLength:function(r){return~~(o.length/2)},write:function(r){for(var t=o,e=0;e+1<t.length;){var n=(255&t[e])<<8|255&t[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),r.put(n,13),e+=2}if(e<t.length)throw"illegal char at "+(e+1)}};return i},M=function(){var r=new Array,t={writeByte:function(t){r.push(255&t)},writeShort:function(r){t.writeByte(r),t.writeByte(r>>>8)},writeBytes:function(r,e,n){e=e||0,n=n||r.length;for(var o=0;o<n;o+=1)t.writeByte(r[o+e])},writeString:function(r){for(var e=0;e<r.length;e+=1)t.writeByte(r.charCodeAt(e))},toByteArray:function(){return r},toString:function(){var t="";t+="[";for(var e=0;e<r.length;e+=1)e>0&&(t+=","),t+=r[e];return t+="]"}};return t},x=function(r){var t=r,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=t.length){if(0==o)return-1;throw new Error("unexpected end of file./"+o)}var r=t.charAt(e);if(e+=1,"="==r)return o=0,-1;r.match(/^\s$/)||(n=n<<6|a(r.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(r){if(65<=r&&r<=90)return r-65;if(97<=r&&r<=122)return r-97+26;if(48<=r&&r<=57)return r-48+52;if(43==r)return 62;if(47==r)return 63;throw new Error("c:"+r)};return i},S=function(r,t){var e=r,n=t,o=new Array(r*t),i={setPixel:function(r,t,n){o[t*e+r]=n},write:function(r){r.writeString("GIF87a"),r.writeShort(e),r.writeShort(n),r.writeByte(128),r.writeByte(0),r.writeByte(0),r.writeByte(0),r.writeByte(0),r.writeByte(0),r.writeByte(255),r.writeByte(255),r.writeByte(255),r.writeString(","),r.writeShort(0),r.writeShort(0),r.writeShort(e),r.writeShort(n),r.writeByte(0);var t=a(2);r.writeByte(2);for(var o=0;t.length-o>255;)r.writeByte(255),r.writeBytes(t,o,255),o+=255;r.writeByte(t.length-o),r.writeBytes(t,o,t.length-o),r.writeByte(0),r.writeString(";")}},a=function(r){for(var t=1<<r,e=1+(1<<r),n=r+1,i=u(),a=0;a<t;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(t)),i.add(String.fromCharCode(e));var f,c,g,s=M(),h=(f=s,c=0,g=0,{write:function(r,t){if(r>>>t!=0)throw new Error("length over");for(;c+t>=8;)f.writeByte(255&(r<<c|g)),t-=8-c,r>>>=8-c,g=0,c=0;g|=r<<c,c+=t},flush:function(){c>0&&f.writeByte(g)}});h.write(t,n);var l=0,w=String.fromCharCode(o[l]);for(l+=1;l<o.length;){var v=String.fromCharCode(o[l]);l+=1,i.contains(w+v)?w+=v:(h.write(i.indexOf(w),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(w+v)),w=v)}return h.write(i.indexOf(w),n),h.write(e,n),h.flush(),s.toByteArray()},u=function(){var r={},t=0,e={add:function(n){if(e.contains(n))throw new Error("dup key:"+n);r[n]=t,t+=1},size:function(){return t},indexOf:function(t){return r[t]},contains:function(t){return void 0!==r[t]}};return e};return i},D=function(r,t,e,n){for(var o=S(r,t),i=0;i<t;i+=1)for(var a=0;a<r;a+=1)o.setPixel(a,i,e(a,i));var u=M();o.write(u);for(var f,c,g,s,h,l,w,v=(f=0,c=0,g=0,s="",l=function(r){s+=String.fromCharCode(w(63&r))},w=function(r){if(r<0);else{if(r<26)return 65+r;if(r<52)return r-26+97;if(r<62)return r-52+48;if(62==r)return 43;if(63==r)return 47}throw new Error("n:"+r)},(h={}).writeByte=function(r){for(f=f<<8|255&r,c+=8,g+=1;c>=6;)l(f>>>c-6),c-=6},h.flush=function(){if(c>0&&(l(f<<6-c),f=0,c=0),g%3!=0)for(var r=3-g%3,t=0;t<r;t+=1)s+="="},h.toString=function(){return s},h),d=u.toByteArray(),p=0;p<d.length;p+=1)v.writeByte(d[p]);v.flush();var y="";return y+="<img",y+=' src="',y+="data:image/gif;base64,",y+=v,y+='"',y+=' width="',y+=r,y+='"',y+=' height="',y+=t,y+='"',n&&(y+=' alt="',y+=n,y+='"'),y+="/>"};return r}();a.stringToBytesFuncs["UTF-8"]=function(r){return function(r){for(var t=[],e=0;e<r.length;e++){var n=r.charCodeAt(e);n<128?t.push(n):n<2048?t.push(192|n>>6,128|63&n):n<55296||n>=57344?t.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&r.charCodeAt(e)),t.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return t}(r)},o=[],void 0===(i="function"==typeof(n=function(){return a})?n.apply(t,o):n)||(r.exports=i)}});
//rebuild by neat 