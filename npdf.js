#!/usr/bin/env node

var fs = require('fs');
var pdf = require('./pdfium.js');
pdf.cwrap('init', null, [])();
// scale = window.devicePixelRatio
pdf.cwrap('set_scale', null, ['number'])(1);

var x11 = require('x11');
var Exposure = x11.eventMask.Exposure;
var KeyPress = x11.eventMask.KeyPress;
x11.createClient(function(err, display) {

  var root = display.screen[0].root;
  var X = display.client;
  var wid = X.AllocID();
  X.CreateWindow(wid, root, 0, 0, 100, 100);
  X.ChangeWindowAttributes(wid, {eventMask: Exposure|KeyPress});
  var gc = X.AllocID();
  X.CreateGC(gc, wid);
  var mapped = false;

  var page_no = 0;

  X.on('event', function(ev) {
    if (ev.name == 'Expose') {
      //X.PutImage(2, wid, gc, width, height, 0, 0, 0, 24, data);
    }

    // TODO: use keysyms
    if (ev.name == 'KeyPress') {
      if (ev.keycode == 132)
        page_no++;
      else if (ev.keycode == 131)
        page_no--;
      pdf.cwrap('render_page', null, ['number'])(page_no);
    }
  });


  fs.readFile(process.argv[2], function(err, buf) {
      var ptr = pdf.cwrap('get_content_buffer', 'number', ['number'])(buf.length);
      for(var i = 0, l = buf.length; i < l; ++i) {
        pdf.HEAP8[ptr+i] = buf[i];
      }
      pdf.cwrap('load', null, [])();
      var page_count = pdf.cwrap('get_page_count', 'number', [])();
      pdf.render = function(page_no, buf, stride, width, height) {
        if (!mapped) {
          mapped = true;
          X.MapWindow(wid);
        }
        var data = new Buffer(width*height*4);
        X.ResizeWindow(wid, width, height);

        var off = 0;
        for(var h = 0; h < height; ++h) {
          var ptr = buf + stride * h;
          for(var w = 0; w < width; ++w) {
            data[off++] = pdf.HEAP8[(ptr)]&255;
            data[off++] = pdf.HEAP8[(ptr+1)]&255;
            data[off++] = pdf.HEAP8[(ptr+2)]&255;
            data[off++] = 255;
            ptr += 4;
          }
        }

      X.PutImage(2, wid, gc, width, height, 0, 0, 0, 24, data);

    };
    pdf.cwrap('render_page', null, ['number'])(0);
  });
});
