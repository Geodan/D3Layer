var tmp;
//Method for moving elements to the front (used to get points on top of polygons)
//Idea from: http://stackoverflow.com/questions/14167863/how-can-i-bring-a-circle-to-the-front-with-d3
d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
  this.parentNode.appendChild(this);
  });
};

window.d3l = function(config){
    var self = this;
    this.map = config.map;
    this.maptype = config.maptype;
    if (config.maptype == 'OpenLayers'){//Getting the correct OpenLayers SVG. 
        var div = d3.selectAll("#" + config.divid);
        div.attr("z-index",10001);
        div.selectAll("svg").remove();
        this.svg = div.append("svg");
    }
    else if (config.maptype == 'Leaflet') { //Leaflet does it easier
        /* Initialize the SVG layer */
        this.map._initPathRoot();
        //var svg = d3.select(this.map.getPanes().overlayPane).append("svg"),
        this.svg = d3.select("#map").select("svg");
    }
    else if (config.maptype == 'D3') {
        this.svg = this.map; 
    }
    
    
    this._layers = [];
    var _legend;
    
    /** Create a legend **/
    this.legend = function(config){
        switch(arguments.length) {
            case 0:
                return _legend;
            default:
                var legenditems = d3.select(config.legendid).selectAll('.layer').data(this._layers);
                legenditems.enter()
                    .append('div')
                    .classed('layer',true)
                    .html(function(d){
                        return d.layername;
                    });
                 legenditems.each(function(d){
                 });
                 legenditems.exit().remove();
        }
    }
    /** Get current zoomlevel **/
    this.getZoomLevel = function(){
        var zoomleven = 0;
        if (self.maptype == 'Leaflet') {
            zoomlevel = self.map.getZoom();
        }
        return zoomlevel;
    }
    
    /** Create a new layer **/
    this.layers = function(layername, config){
        switch(arguments.length) {
            case 0:
                return this._layers;
            default:
                $.each(this._layers,function(i,layer){
                    if (layer.layername == layername){
                        return layer;  
                    }
                });
                var layer = new d3layer(layername, config);
                this._layers.push(layer);
                return layer;
        }
    }

    var d3layer = function(layername, config){
		var f = {}, bounds, feature, collection;
		this.f = f;
		var _this = this;        
		var layername = layername;
		f.layername = layername;
		this.data;
		this.type = config.type || "path";
		
		this.style = config.style;
		this.onClick = config.onClick;
		this.onMouseover = config.onMouseover;
		this.mouseoverContent = config.mouseoverContent;
		this.classfield = config.classfield;
		this.satellites = config.satellites || false;
		this.eachFunctions = config.eachFunctions || false;	
		this.coolcircles = config.coolcircles || false;
		this.labels = config.labels || false;
		this.labelconfig = config.labelconfig;
		this.highlight = config.highlight || false;
		this.scale = config.scale || 'px';
		this.pointradius = config.pointradius || 5;
		this.bounds = [[0,0],[1,1]];
		var width, height,bottomLeft,topRight;
        var g;

        //Adding a tooltip div
        var tooltipdiv = d3.select("body").append("div")   
            .attr("class", "tooltip")               
            .style("opacity", 0);
        
        f.onAdd = function(d){
            //TODO: leaflet methods for turning layer on/off   
        }
        
        f.onRemove = function(d){
            
        }

        
		if (self.maptype == 'OpenLayers'){//Getting the correct OpenLayers SVG. 
			g = self.svg.append("g");
		}
		else if (self.maptype == 'Leaflet') { //Leaflet does it easier
			g = self.svg.append("g").attr("class", "leaflet-zoom-hide");
		}
		else if (self.maptype == 'D3') {
		     
		}

		this.g = g;
		//In Chrome the transform element is not propagated to the foreignObject
        //Therefore we have to calculate our own offset
        this.offset = function(x){
            var offset = {x:0,y:0}; 
            if (navigator.userAgent.indexOf('Chrome') > -1)
                if (config.maptype == 'Leaflet'){//only works in leaflet
                    offset = _this.map.latLngToContainerPoint(new L.latLng(x[1],x[0]));
                    //offset = _this.map.latLngToLayerPoint(new L.LatLng(x[1], x[0])); //Leaflet version
                }
            return offset;
         }
            
        // Projecting latlon to screen coordinates
		this.project = function(x) {
		  if (self.maptype == 'D3') {
		    var point = projection(x);
		    return [point[0],point[1]];
		  }
		  else if (self.maptype == 'Leaflet'){
	  	      var point = self.map.latLngToLayerPoint(new L.LatLng(x[1], x[0])); //Leaflet version
		  	  //var point = _this.map.latLngToContainerPoint(new L.LatLng(x[1], x[0])); //Leaflet version
		  }
		  else if (self.maptype == 'OpenLayers'){
		  	  var loc =  new OpenLayers.LonLat(x[0],x[1]);
		  	  var fromproj = new OpenLayers.Projection("EPSG:4326");
		  	  var toproj = new OpenLayers.Projection("EPSG:900913");
		  	  loc.transform(fromproj, toproj);
		  	  var point = self.map.getViewPortPxFromLonLat(loc); //OpenLayers version
		  }
		  else {
		  	  console.warn("Error, no correct maptype specified for d3 layer " + layername);
		  	  return;
		  }
		  return [point.x, point.y];
		};
		
		
		var olextentproject = function(x){
			var point = _this.map.getViewPortPxFromLonLat(new OpenLayers.LonLat(x[0],x[1]));
			return [point.x,point.y];
		}
		//TODO move out of core
		var labelgenerator = function(d){
		    if (_this.labelconfig.field){
		        var str = d.properties[_this.labelconfig.field];
		        if (str && str.length > 10) 
		              return str.substr(0,16) + "..."; //Only first 10 chars
		        else return str;
            }
            else
                return d.id;
		}
		
		var geoPath = d3.geo.path().projection(this.project);
		this.geoPath = geoPath;
		var click = function(d){
		    d3.event.stopPropagation();//Prevent the map from firing click event as well
		    if (_this.onClick)
		        _this.onClick(d,this);
		}
		
		var mouseover = function(d){
		    if (_this.mouseoverContent){
                    tooltipdiv.transition()        
                        .duration(200)      
                        .style("opacity", .9);      
                    tooltipdiv.html(d[_this.mouseoverContent] + "<br/>")  
                        .style("left", (d3.event.pageX) + "px")     
                        .style("top", (d3.event.pageY - 28) + "px");
                }
		    if (_this.onMouseover)
		        _this.onMouseover(d,this);
		}
		var mouseout = function(d){
		    if (_this.mouseoverContent){
		        tooltipdiv.transition()        
                    .duration(500)      
                    .style("opacity", 0);
            }
		}
		
		//Build up the element
		this.build = function(d){
		  var entity = d3.select(this);
  	      //Point/icon feature
		  if (d.style && d.style.icon && d.geometry.type == 'Point'){ 
		      var x = _this.project(d.geometry.coordinates)[0];
              var y = _this.project(d.geometry.coordinates)[1];
		      var img = entity.append("image")
		            .transition().duration(500)
		            .on("click", click)
		            .on('mouseover',mouseover)
		            .on('mouseout',mouseout);
		  }
		  //Path feature
		  else{
		    var path = entity.append("path")
		        .on("click", click)
		        .on('mouseover',mouseover)
		        .on('mouseout',mouseout)
		        .transition().duration(500);
		  }
		}
		
		//A per feature styling method
		this.styling = function(d){
		  var entity = d3.select(this);
		  //Point/icon feature
		  if (d.style && d.style.icon && d.geometry.type == 'Point'){ 
		      var x = _this.project(d.geometry.coordinates)[0];
              var y = _this.project(d.geometry.coordinates)[1];
		      var img = entity.select("image")
                    .attr("xlink:href", function(d){
                            if (d.style.icon) return d.style.icon;
                            else return "./mapicons/stratego/stratego-flag.svg";
                    })
                    .classed("nodeimg",true)
                    .attr("width", 32)
                    .attr("height", 37)
                    .attr("x",x-25)
                    .attr("y",y-25)
                    .style('opacity',function(d){ //special case: opacity for icon
                            return d.style.opacity || _this.style.opacity || 1;
                    });
             
		  }
		  //Path feature
		  else{
		    var path = entity.select("path");
			for (var key in _this.style) { //First check for generic layer style
				path.style(key,function(d){
					if (d.style && d.style[key])
						return d.style[key]; //Override with features style if present
 					else	
						return _this.style[key]; //Apply generic style
				});
			};
			//Now apply remaining styles of feature (possible doing a bit double work from previous loop)
			if (d.style) { //If feature has style information
				for (var key in d.style){ //run through the styles
					path.style(key,d.style[key]); //and apply them
				}
			}
		  }
		};
		
		//A per feature styling method
		this.textstyling = function(d){ 
			for (var key in _this.labelconfig.style) { //First check for generic layer style
				d3.select(this).style(key,function(d){
					if (d.labelconfig && d.labelconfig.style && d.labelconfig.style[key])
						return d.labelconfig.style[key]; //Override with features style if present
 					else	
						return _this.labelconfig.style[key]; //Apply generic style
				});
			};
			//Now apply remaining styles of feature (possible doing a bit double work from previous loop)
			if (d.labelconfig && d.labelconfig.style) { //If feature has style information
				for (var key in d.labelconfig.style){ //run through the styles
					d3.select(this).style(key,d.labelconfig.style[key]); //and apply them
				}
			}
		};
		
		//Some path specific styles (point radius, label placement eg.)
		this.pathStyler = function(d){ 
		    if (d.style && d.style.radius)
		        geoPath.pointRadius(d.style.radius);
		    else if (_this.style && _this.style.radius)
		        geoPath.pointRadius(_this.style.radius);
		    return geoPath(d);
		};
		
		//Calculating the location of the label, based on settings
		this.textLocation = function(d){
		    var textLocation = geoPath.centroid(d);
		    var bounds = geoPath.bounds(d);
		    if (_this.style && _this.style.textlocation){
		        switch(_this.style.textlocation){
		          case 'ul':
		            textLocation[0] = bounds[0][0];
		            textLocation[1] = bounds[0][1];
		            break;
		          case 'ur':
		            textLocation[0] = bounds[1][0];
		            textLocation[1] = bounds[1][1];
		            break;
		          //TODO: add other positions
		        }
		    }
		    else {
		        textLocation[1] = textLocation[1] + 20; //a bit down..
		    }
		    return textLocation;
		}
		
		//The part where new data comes in
		f.data = function(data){
		    if (!data){
		        return _this.data; 
		    }
		    var points = [];
		    var lines = [];
		    var polygons = [];
		    var collection = {"type":"FeatureCollection","features":[]}; 
		    //A method to order the objects based on types
		    //Points on top, then lines, then polygons
		    $.each(data.features, function(i,d){
		         if (d.geometry.type == 'Point'){
		             points.push(d);
		         }
		         else if (d.geometry.type == 'LineString'){
		             lines.push(d);
		         }
		         else if (d.geometry.type == 'Polygon' ||d.geometry.type == 'MultiPolygon' ){
		             polygons.push(d);
		         }
		         else {
		             console.warn(layername + ' has unknown geometry type: ',d.geometry.type);
		         }
		    });
		    //little hack from http://stackoverflow.com/questions/1374126/how-to-append-an-array-to-an-existing-javascript-array
		    collection.features.push.apply(collection.features,polygons);
   		    collection.features.push.apply(collection.features,lines);
		    collection.features.push.apply(collection.features,points);
		    
		    _this.data = collection;
		    _this.bounds = d3.geo.bounds(collection);
            
			//Create a 'g' element first, in case we need to bind more then 1 elements to a data entry
			var entities = g.selectAll(".entity")
			    .data(collection.features, function(d){
			        return d.id;
			    });
			
			//On enter
			var newentity = entities.enter()
			    .append('g')
			    .classed('entity',true)
                .attr('id',function(d){
                    return 'entity'+ d.id;
                })			    
			    ;

            newentity.each(_this.build);
			
			if (_this.labels){
			    var label = newentity.append('g')
			        .classed('place-label',true);
			    //On new:	
				label
					.append('text')
					.attr("x",function(d) {return _this.textLocation(d)[0] ;})
					.attr("y",function(d) {return _this.textLocation(d)[1] ;})
					//.classed("zoomable",true)
					.attr('text-anchor', 'left')
					.style('stroke','white')
					.style('stroke-width','3px')
					.style('stroke-opacity',.8)
					.text(function(d){return labelgenerator(d)});
				label
					.append('text')
					.attr("x",function(d) {return _this.textLocation(d)[0] ;})
					.attr("y",function(d) {return _this.textLocation(d)[1] ;})
					//.classed("zoomable",true)
					.attr('text-anchor', 'left')
					.each(_this.textstyling)
					.text(function(d){return labelgenerator(d)});
			} //End of new label
			//Some cool looking effect upon new feature
			if (_this.coolcircles){
			 var coolcircle = newentity.append('g')
			        .classed('coolcircle',true);
			 coolcircle.append("circle")
                  .attr("class", "ring")
                  .attr("cx",function(d) { return _this.project(d.geometry.coordinates)[0]})
                  .attr("cy",function(d) { return _this.project(d.geometry.coordinates)[1]})
                  .attr("r", 100)
                  .each(_this.styling)
                  .style("stroke-width", 3)
                  .style("fill","none")
                .transition()
                  .ease("linear")
                  .duration(1500)
                  .each(_this.styling)
                  .style("stroke-opacity", 1e-6)
                  .style("stroke-width", 1)
                  .style("fill","none")
                  .attr("cx",function(d) { return _this.project(d.geometry.coordinates)[0]})
                  .attr("cy",function(d) { return _this.project(d.geometry.coordinates)[1]})
                  .attr("r", 6)
                  .remove();
            }
            
            //Add custum functions to each feature
            if (_this.eachFunctions){
                _this.eachFunctions.forEach(function(f){
                    newentity.each(function(d,i){
                        f(d,i,this,_this);//TODO: ugly
                    });
                });
            }
            
			//On update
			entities.each(_this.styling);
			entities.each(function(d,i){
			    var entity = d3.select(this);
			    var x = geoPath.centroid(d)[0];
                var y = geoPath.centroid(d)[1];
                
                if (d.style && d.style.icon && d.geometry.type == 'Point'){
                    var x = x;
                    var y = y;
                    entity.select('image')
                        .attr("x",x-25)
                        .attr("y",y-25);
                }
                else{
                    entity.select('path') //Only 1 path per entity
                        .attr("d",_this.pathStyler(d))
                        .style('opacity',0)
                        .transition().duration(500)
                        .style('opacity',1)
                        ;
                }
			    
			    if (_this.labels){
			        entity.select('.place-label')
                        .selectAll('text')
                        .transition().duration(500)
                        .attr("x", _this.textLocation(d)[0] )
                        .attr("y", _this.textLocation(d)[1] )
                        .text(labelgenerator(d));
			    }
			});
			//On exit	
			entities.exit().remove().transition().duration(500);
			return f;
        }
        
        //Redraw all features
		f.reset = function(e) {
			if (self.maptype == 'OpenLayers'){
                var extent = _this.map.getExtent();
                bottomLeft = olextentproject([extent.left,extent.bottom]);
                topRight = olextentproject([extent.right,extent.top]);
                width = topRight[0] - bottomLeft[0];
                height = bottomLeft[1] - topRight[1];
                svg.attr("width", width)
                    .attr("height", height)
                    .style("margin-left", bottomLeft[0] + "px")
                    .style("margin-top", topRight[1] + "px");
            }
            else {
                    //var bottomLeft = _this.project(_this.bounds[0]),
                    //    topRight = _this.project(_this.bounds[1]);
                    //svg.attr("width", (topRight[0] - bottomLeft[0]) + 200)
                    //    .attr("height", (bottomLeft[1] - topRight[1]) + 200)
                    //    .style("margin-left", bottomLeft[0] - 100 + "px")
                    //    .style("margin-top", topRight[1] - 100 + "px");
                    //g.attr("transform", "translate(" + -bottomLeft[0] + "," + -topRight[1] + ")");
            }
            g.selectAll(".entity")
                .each(function(d,i){
                    var entity = d3.select(this);
                    var x = geoPath.centroid(d)[0];
                    var y = geoPath.centroid(d)[1];

                    if (d.style && d.style.icon && d.geometry.type == 'Point'){
                        entity.select('image')
                            .attr("x",x-25)
                            .attr("y",y-25)
                            .moveToFront();
                    }
                    else{
                        entity.select('path') //Only 1 path per entity
                            .attr("d",_this.pathStyler(d))
                    }
                    
                     if (_this.labels){
                        entity.select('.place-label')
                            .selectAll('text')
                            .attr("x", _this.textLocation(d)[0] )
                            .attr("y", _this.textLocation(d)[1] )
                            .text(labelgenerator(d));
                    }
                    entity.select('g.zoomable')
                        .attr("transform", function(d){
                            if (d.geometry.type == 'Point'){
                                var x = _this.project(d.geometry.coordinates)[0];
                                var y = _this.project(d.geometry.coordinates)[1];
                            }
                            else {
                                var x = _this.geoPath.centroid(d)[0];
                                var y = _this.geoPath.centroid(d)[1];
                            }
                            return "translate(" + x + "," + y + ")"
                        })
                        .transition().duration(500)
                        .attr('opacity',function(d){
                                if (d.minzoomlevel && d.minzoomlevel > self.getZoomLevel()){
                                    return 0;
                                }
                                else return 1;
                        });
                    
                    
                });
		}
		f.reset();
		return f;
	}
};
