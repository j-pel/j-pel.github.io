(function(exports) {

  'use strict';

  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth();
  var day = today.getDate();
	var db = null;

  var init = exports.init = function(server) {
    db = Couching(server);
/*    db.changes({
      since: 'now',
      live: true
    }).on('change', updateView);
*/  
    return 0;
	}
	
	var prepareView = exports.prepareView = function(name,password) {
    return db.login({
      name:name,
      password:password
    }).then(function(info){
      prepare();
    }).catch(function(err){
      console.log('Prepare error',err);
    });
  }
  
  var updateView = exports.updateView = function() {
    return db.query('index/date', {
      include_docs: false,
      limit:13,
      descending: true,
      attachments: true
    }).then(function (result) {
      redrawView(result.rows);
    }).catch(function (err) {
      console.log(err);
    });
	}

	function redrawView(obj) {
    var nav = document.getElementById("navigator");
    var i = 0;
    nav.appendChild(createSelector(i,"+"))
    obj.forEach(function(item) {
      i++;
      nav.appendChild(createSelector(i,moment(item.value.fecha).format("MMM")));
      item.value.index = i;
      item.value.draw = slideShow;
      sliding.append(item.value);
		});
	}

  var storeInfo = exports.storeInfo = function() {
    var form = document.getElementById("form1");
    var doc = {_id: form["fecha"].value}
    var inputs = form.getElementsByTagName('input');
    for (var index = 0; index < inputs.length; ++index) {
      dotIndex(doc,inputs[index].id,inputs[index].value);
    }
    return db.put(doc).then(function (result) {
      console.log(result);
    }).catch(function (err) {
      console.log(err);
    });
  }

  function slideShow(viewport,slide) {
    var container = document.getElementById("form1");
    if (slide===undefined) {
      document.getElementById('fecha').value = year + "-" 
        + ("00"+(month+1)).slice(-2) + "-"
        + ("00"+day).slice(-2);
    } else {
      selectSlide(slide.index);
      for (var inputs in slide) {
        if (typeof slide[inputs] == "object") {
          for (var inputs2 in slide[inputs]) {
            var input = container[inputs+"."+inputs2];
            if (input) {
              input.value=slide[inputs][inputs2];
            }
          }
        } else {
          var input = container[inputs];
          if (input) {
            input.value=slide[inputs];
          }
        }
      }
    }
  }
	
  function createSelector(id,info) {
    var li = document.createElement('li');
    li.id = "S"+id;
    li.appendChild(document.createTextNode(info));
    li.addEventListener('click', function(evt){
      sliding.select(id-1);
		});
    return li;
  }
  
  function selectSlide(id) {
    var elementList = document.getElementsByClassName('selected');
    for (var i = 0; i < elementList.length; i++) {
      elementList[i].classList.remove('selected');
    }
    document.getElementById("S"+id).classList.add('selected');
  }


  var redrawGraph = exports.redrawGraph = function(thing) {
    var lbls = [];
    var data1 = [];
    var base1 = 0;
    var date1 = "";
    slide_list.forEach(function(item) {
      if (base1==0) {
        base1 = item[thing];
        date1 = item.fecha;
      } else {
        data1.push((item[thing]-base1)/moment(item.fecha).diff(date1, 'days'));
        date1 = item.fecha;
        base1 = item[thing];
        lbls.push(moment(item.fecha).format("MMM YY"));
      }
		});
    var ctx = document.getElementById("myChart");
    var myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: lbls,
        datasets: [{
            label: thing+" [un/día]",
            backgroundColor: "rgba(120,220,120,0.2)",
            yAxisID: "y-axis-0",
            data: data1
        }]
      },
      options: {
        scales: {
          yAxes: [{
              id: "y-axis-0",
              position: "right",
              ticks: {
                beginAtZero:false
              }
            }],
          xAxes: [{
            position: "bottom",
            time: {
              parser: "YYYY-MM",
              unit: "month"
            }
            }]
        }
      }
    });
  }

	
  function dotIndex(obj, is, value) {
    if (typeof is == 'string')
      return dotIndex(obj,is.split('.'), value);
    else if (is.length==1)
      return obj[is[0]] = value;
    else if (is.length==0)
      return obj;
    else
      obj[is[0]] = typeof obj[is[0]] !== 'undefined' ?  obj[is[0]] : {};
      return dotIndex(obj[is[0]],is.slice(1), value);
  }

  function prepare() {
    var doc = {
      _id: "_design/index",
      views: {
         date: {
            map: function (doc) {
              emit(doc.fecha,doc);
            }
         },
         precios: {
            map: function (doc) {
              emit(doc.unitario,doc);
            }
         }
      },
      shows: {
        invoices: function(doc, req) {
          var info = {};
          info.fecha = doc.fecha;
          var role = req.userCtx.roles[0];
          info.rol = role;
          switch(role) {
          case "editor":
            break;
          case "_admin":
            break;
          default:
            break;
          }

          return {
            headers: {
              "Content-Type" : "application/json"
            },
            body: toJSON(info)
          }
        }
      },
      lists: {
        allowed: function(head,req){
          var row;
          start({
            "headers": {"Content-Type": "application/json"}
          });
          var role = req.userCtx.roles[0];
          switch(role) {
          case "editor":
            break;
          case "_admin":
            while(row = getRow()) {
              send(toJSON(row.value));
            }
            break;
          default:
            send("{\"error\":\"No autorizado\"}");
          }
        }
      },
      validate_doc_update: function(newDoc, oldDoc, userCtx) {
        throw({
          forbidden : 'Faltan permisos para realizar la operación'
        });
      }
    };
    db.put(toDesignDoc(doc)).then(function(info){
      console.log("Ok put:",info);
    }).catch(function(err){
      console.log("Error in design document put:",err);
    });
  }

  function toDesignDoc(obj){
    switch (typeof obj) {
    case 'object':
      var doc = {};
      for (var item in obj) {
        doc[item] = toDesignDoc(obj[item]);
      }
      return(doc);
      break;
    case 'function':
      return(obj.toString());
      break;
    default:
      return(obj);
    }
  }

})(typeof exports === 'undefined'? this['servicios']={}: exports);
