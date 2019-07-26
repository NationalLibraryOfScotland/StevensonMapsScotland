var map;
var overlay; //current historic overlay node
var overlayLayers;
var baseLayer;
var baseLayers; // base layers include Bing and ESRI maps, and OpenStreetMap
var overlaySelected;
var subjectname;
var hover;
selectedFeaturesFromResults = [];
selectedFeatureszoomtoID = [];
DEFAULT_ZOOM = 6;
DEFAULT_LAT =  57.4;
DEFAULT_LON = -3.73;
DEFAULT_ID = '0';
var zoomvalextent;
var filterinprocess;
var filterstart;

filterstart = true;
// console.log("filterstart = true");

// Proj4 definition for British National Grid

	proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

// necessary for use of Bing layers - generate your own at: https://msdn.microsoft.com/en-us/library/ff428642.aspx

	var BingapiKey = "AgS4SIQqnI-GRV-wKAQLwnRJVcCXvDKiOzf9I1QpUQfFcnuV82wf1Aw6uw5GJPRz";

// a generic attribution variable for LINZ sheet lines
	
	var LINZ_attribution = new ol.Attribution({
	  html: ' Sheet boundaries courtesy of <a href="//www.linz.govt.nz/" >Land Information New Zealand (LINZ)</a> and licensed by LINZ for re-use under the <a href="http://creativecommons.org/licenses/by/4.0/" >Creative Commons Attribution 4.0 International&nbsp;licence</a>.' 
	});
	
	
// Conversions between British National Grid and lat / long
// From https://www.movable-type.co.uk/scripts/latlong-gridref.html NT261732

    function gridrefNumToLet(e, n, digits) {
        // get the 100km-grid indices
        var e100k = Math.floor(e / 100000),
        n100k = Math.floor(n / 100000);

        if (e100k < 0 || e100k > 6 || n100k < 0 || n100k > 12) return '';

        // translate those into numeric equivalents of the grid letters
        var l1 = (19 - n100k) - (19 - n100k) % 5 + Math.floor((e100k + 10) / 5);
        var l2 = (19 - n100k) * 5 % 25 + e100k % 5;

        // compensate for skipped 'I' and build grid letter-pairs
        if (l1 > 7) l1++;
        if (l2 > 7) l2++;
        var letPair = String.fromCharCode(l1 + 'A'.charCodeAt(0), l2 + 'A'.charCodeAt(0));

        // strip 100km-grid indices from easting & northing, and reduce precision
        e = Math.floor((e % 100000) / Math.pow(10, 5 - digits / 2));
        n = Math.floor((n % 100000) / Math.pow(10, 5 - digits / 2));

        Number.prototype.padLZ = function(w) {
            var n = this.toString();
            while (n.length < w) n = '0' + n;
            return n;
        }

        var gridRef = letPair + e.padLZ(digits / 2) + n.padLZ(digits / 2);

        return gridRef;
    }
	function gridrefLetToNum(gridref) {
	  // get numeric values of letter references, mapping A->0, B->1, C->2, etc:
	  var l1 = gridref.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
	  var l2 = gridref.toUpperCase().charCodeAt(1) - 'A'.charCodeAt(0);
	  // shuffle down letters after 'I' since 'I' is not used in grid:
	  if (l1 > 7) l1--;
	  if (l2 > 7) l2--;

	  // convert grid letters into 100km-square indexes from false origin (grid square SV):
	  var e = ((l1-2)%5)*5 + (l2%5);
	  var n = (19-Math.floor(l1/5)*5) - Math.floor(l2/5);

	  // skip grid letters to get numeric part of ref, stripping any spaces:
	  gridref = gridref.slice(2).replace(/ /g,'');

	  // append numeric part of references to grid index:
	  e += gridref.slice(0, gridref.length/2);
	  n += gridref.slice(gridref.length/2);

	  // normalise to 1m grid, rounding up to centre of grid square:
	  switch (gridref.length) {
		case 2: e += '5000'; n += '5000'; break;
	    case 4: e += '500'; n += '500'; break;
	    case 6: e += '50'; n += '50'; break;
	    case 8: e += '5'; n += '5'; break;
	    // 10-digit refs are already 1m
	  }

	  return [e, n];
	}

// the base map layers


	var osm = new ol.layer.Tile({
	  	title: 'Background Map - OpenStreetMap',
        	visible: false,
	  	source: new ol.source.OSM()
	});

// ESRI World Layers

	var esri_world_topo = new ol.layer.Tile({
		title: 'Background Map - ESRI World Topo',
        	visible: false,
		    source: new ol.source.XYZ({
			          attributions: [
			            new ol.Attribution({ html: 'Tiles &copy; <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer">ArcGIS</a>'})
			          ],
			              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/' +
			                  'World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
	      	})
	    });

	var esri_world_imagery = new ol.layer.Tile({
		title: 'Background Map - ESRI World Imagery',
        	visible: false,
		    source: new ol.source.XYZ({
			          attributions: [
			            new ol.Attribution({ html: 'Tiles &copy; <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">ArcGIS</a>'})
			          ],
			              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/' +
			                  'World_Imagery/MapServer/tile/{z}/{y}/{x}'
	      	})
	    });


// Bing layers
	
	var BingSatellite =   new ol.layer.Tile({
		title: 'Background Map - Bing Satellite',
        	visible: false,
	        source: new ol.source.BingMaps({
			key: BingapiKey,
			imagerySet: 'Aerial'
		    })
	});

	var BingRoad = new ol.layer.Tile({
	        title: 'Background Map - Bing Road',
        	visible: false,
	        source: new ol.source.BingMaps({
		      key: BingapiKey,
		      imagerySet: 'Road'
		    })
	});

	var BingAerialWithLabels = new ol.layer.Tile({
	        title: 'Background Map - Bing Hybrid',
        	visible: false,
	        source: new ol.source.BingMaps({
			key: BingapiKey,
			imagerySet: 'AerialWithLabels'
		})
	});


	var OS1920s =  	new ol.layer.Tile({
	            title: 'Background map - OS 1920s',
	            mosaic_id: '9',
	            type: 'base',
		    source: new ol.source.XYZ({
			          attributions: [
			            new ol.Attribution({html: '<a href=\'https://maps.nls.uk/projects/api/\'>NLS Historic Maps API</a>'})
			          ],
				url: 'https://geo.nls.uk/maps/api/nls/{z}/{x}/{y}.jpg',
				// minZoom: 10,
				maxZoom: 13,
				tilePixelRatio: 1
		})
          });


	var OS1900sGBback =  new ol.layer.Tile({
	            title: 'Background map - OS 1900s',
  			extent: ol.proj.transformExtent([-8.8, 49.8, 1.77, 60.9 ], 'EPSG:4326', 'EPSG:3857'),
		   	source: new ol.source.XYZ({
			          attributions: [
			            new ol.Attribution({html: '<a href=\'https://maps.nls.uk/projects/subscription-api/\'>NLS Historic Maps Subscription API layer</a>'})
			          ],
			          urls:[
			            'https://nls-0.tileserver.com/fpsUZbqQLWLT/{z}/{x}/{y}.jpg',
			            'https://nls-1.tileserver.com/fpsUZbqQLWLT/{z}/{x}/{y}.jpg',
			            'https://nls-2.tileserver.com/fpsUZbqQLWLT/{z}/{x}/{y}.jpg',
			            'https://nls-3.tileserver.com/fpsUZbqQLWLT/{z}/{x}/{y}.jpg'
			          ],
				minZoom: 1,
				maxZoom: 17

		}),
          });

	var stamentoner = new ol.layer.Tile({
		title: 'Background map - Stamen Toner',
	        source: new ol.source.Stamen({
				attributions: new ol.Attribution({
	  				html: 'Map tiles by <a href="https://stamen.com">Stamen Design</a>, under <a href="https://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="https://openstreetmap.org">OpenStreetMap</a>, under <a href="https://www.openstreetmap.org/copyright">ODbL</a>.'
					}),
	        		layer: 'toner'
	      })
	    });

// an array of the base layers listed above

	var baseLayers = [ OS1900sGBback, esri_world_topo, esri_world_imagery, BingAerialWithLabels, BingRoad, osm, stamentoner, OS1920s ];

// sets background layer to be visible and with a 0.6 transparency

	OS1900sGBback.setVisible(true);

 	baseLayers[0].setOpacity(0.6);

// create default text in Results panel with nothing selected

        setResults();

// parse the URL after the # character to obtain URL parameters

	function splitWindowLocationHash()
		{
			args = [];
			var hash = window.location.hash;
			if (hash.length > 0)
			{
				var elements = hash.split('&');
				elements[0] = elements[0].substring(1); /* Remove the # */
		
				for(var i = 0; i < elements.length; i++)
				{
					var pair = elements[i].split('=');
					args[pair[0]] = pair[1];
				}
			}
		}


	splitWindowLocationHash();

		var currentZoom = DEFAULT_ZOOM;
		var currentLat = DEFAULT_LAT;
		var currentLon = DEFAULT_LON;
		var currentID = DEFAULT_ID;
		if (args['zoom'])
		{
			currentZoom = args['zoom'];
		}
		if (args['lat'] && args['lon'])
		{
			currentLat = parseFloat(args['lat']); 
			currentLon = parseFloat(args['lon']);		
		}
		if (args['id'])
		{
			currentID = args['id'];
		}



// updates the URL after the # with the map zoom, lat and lon, and point paremeter

	function updateUrl()
		{

			var centre = ol.proj.transform(map.getView().getCenter(), "EPSG:3857", "EPSG:4326");

			 if (currentID == undefined)
			 {
				currentID == '0';
			 }

			 if (currentID !== '0')

			 {
			window.location.hash = "zoom=" + map.getView().getZoom()  + "&lat=" + centre[1].toFixed(4)  + "&lon=" + centre[0].toFixed(4) + "&id=" + currentID; 
			 }


	
			{
			window.location.hash = "zoom=" + map.getView().getZoom()  + "&lat=" + centre[1].toFixed(4)  + "&lon=" + centre[0].toFixed(4); 
			}

	}

// sets up the base layers as a drop-down list

	    var layerSelect = document.getElementById('layerSelect');
	    for (var x = 0; x < baseLayers.length; x++) {
	        // if (!baseLayers[x].displayInLayerSwitcher) continue;
	        var option = document.createElement('option');
		option.appendChild(document.createTextNode(baseLayers[x].get('title')));
	        option.setAttribute('value', x);
	        option.setAttribute('id', 'baseOption' + baseLayers[x].get('title'));
	        layerSelect.appendChild(option);
	    }

// subject categories for the maps

	everything = ({ name: "All Subjects" });
	bridges = ({ name: "Bridges", searchterm: "Bridge" });
	buildings = ({ name: "Buildings / Monuments", searchterm: "Building/Monument" });
	canals = ({ name: "Canals", searchterm: "Canal" });
	harbours = ({ name: "Harbours", searchterm: "Harbour"  });
	lighthouses = ({ name: "Lighthouses", searchterm: "Lighthouse"  });
	reference = ({ name: "Reference Material", searchterm: "Reference Material"  });
	railways = ({ name: "Railways", searchterm: "Railway"  });
	river = ({ name: "River", searchterm: "River"  });
	road = ({ name: "Road", searchterm: "Road"  });
	water = ({ name: "Water Supply Works", searchterm: "Water Supply Works"  });

// an array of the subject categories

	var subjects = [ everything, bridges, buildings, canals, harbours, lighthouses, reference, railways, river, road, water ];

// sets up the subjects as a drop-down list

	    var subjectSelect = document.getElementById('subjectselect');
	    for (var x = 0; x < subjects.length; x++) {
	        var option = document.createElement('option');
		option.appendChild(document.createTextNode(subjects[x].name));
	        option.setAttribute('value', x);
	        option.setAttribute('id',  subjects[x].name);
	        subjectSelect.appendChild(option);
	    }

// styles for vector features

// the style for the blue lines

            var blue_line_thick = new ol.style.Style({
    		stroke: new ol.style.Stroke({
      			color: 'rgba(41, 15, 195, 1)',
      			width: 2
    		})
  	    });

// the style for the pale blue lines

            var pale_blue_line = new ol.style.Style({
    		stroke: new ol.style.Stroke({
      			color: 'rgba(125, 125, 255, 0.7)',
      			width: 2
    		})
  	    });

// selected style when polygons are selected

            var selectedStyle = new ol.style.Style({
    		stroke: new ol.style.Stroke({
      			color: 'rgba(255, 0, 0, 0.7)',
      			width: 3
    		}),
	    	fill: new ol.style.Fill({
			color: 'rgba(250, 0, 0, 0.005)'
                    }),
  	    });


// selected style when polygons are hovered over

            var selectedStyleOnHover = new ol.style.Style({
    		stroke: new ol.style.Stroke({
      			color: 'rgba(255, 0, 0, 0.5)',
      			width: 2
    		}),
	    	fill: new ol.style.Fill({
			color: 'rgba(250, 0, 0, 0)'
                    }),
  	    });

// selected style for single items

        var selectedStyleSingle = new ol.style.Style({
                stroke: new ol.style.Stroke({
      			color: 'rgba(255, 0, 0, 0.9)',
                        width: 5
                    }),
	    	fill: new ol.style.Fill({
			color: 'rgba(255, 0, 0, 0.5)'
                    }),
                });

// the Stevenson GeoJSON file for all the maps

	var stevenson_geojson = 'stevenson_areas.js';

// adding the Stevenson GeoJSON to the vector source and layer

	var stevenson_geojson_source = new ol.source.Vector({
		    url: stevenson_geojson,
    		    format: new ol.format.GeoJSON(),
		  });


	var stevenson_geojson_layer = new ol.layer.Vector({
		  title: "Stevenson maps",
		  source: stevenson_geojson_source,
		visible: true,
	        style: blue_line_thick,
	      });







// creating the source and vector layer for the pale blue unselectabale features

	stevenson_geojson_unselectable = [];

	var stevenson_geojson_pale_blue = new ol.source.Vector({
		    source: stevenson_geojson_unselectable,
    		    format: new ol.format.GeoJSON(),
		  });


	var stevenson_geojson_layer2 = new ol.layer.Vector({
		  title: "Stevenson maps - pale blue",
		  source: stevenson_geojson_pale_blue,
		visible: true,
	        style: pale_blue_line,
	      });

// creating the source and vector layer for the dark blue selectabale features

	stevenson_geojson_updated = [];

	var stevenson_geojson_updated_source = new ol.source.Vector({
		    source: stevenson_geojson_updated,
    		    format: new ol.format.GeoJSON(),
		  });


	var stevenson_geojson_layer3 = new ol.layer.Vector({
		  title: "Stevenson maps - for selection",
		  source: stevenson_geojson_updated_source,
		visible: true,
	        style: blue_line_thick,
	      });

// creating the source and vector layer for the selected red features

	stevenson_geojson_updated_selection = [];

	var stevenson_geojson_updated_selection_source = new ol.source.Vector({
		    source: stevenson_geojson_updated_selection,
    		    format: new ol.format.GeoJSON(),
		  });


	var stevenson_geojson_layer4 = new ol.layer.Vector({
		  title: "Stevenson maps - temporarily selected on click",
		  source: stevenson_geojson_updated_selection_source,
		visible: true,
	        style: selectedStyle,
	      });



// maximum geographic extents of the map viewer window

		var maxExtent = [-1135346.8784413887, 6860830.640808259, 36279.89111379313, 8626831.74230897];

// the main OpenLayers map definition, with controls, layers and extents

		var map = new ol.Map({
		  target: document.getElementById('map'),
		  renderer: 'canvas',
		  controls: ol.control.defaults({ attributionOptions: { collapsed: true, collapsible: true }}),
		  interactions : ol.interaction.defaults({doubleClickZoom :false}),
		  layers: [OS1900sGBback, stevenson_geojson_layer, stevenson_geojson_layer2, stevenson_geojson_layer3, stevenson_geojson_layer4],
		  logo: false,
		  view: new ol.View({
		    center: ol.proj.transform([currentLon, currentLat], 'EPSG:4326', 'EPSG:3857'),
		    zoom: currentZoom,
		    extent: maxExtent,
		    minZoom: 5
		  })
		});


document.getElementById('loading_results').innerHTML  = "<p>&nbsp;Loading features - please wait...&nbsp;</p>";

// event listener to update the URL when the map is moved

         map.on('moveend', updateUrl);


function zoomtoID(currentID)  {

	var source = map.getLayers().getArray()[1].getSource();  

			source.forEachFeature( function(feature){
				if(feature.get('SURVEYID') === currentID)
				selectedFeatureszoomtoID = [];
				selectedFeatureszoomtoID.push(feature);
				});

	       		var i;
	                for(i=0; i< selectedFeatureszoomtoID.length; i++) {
			 selectedFeatureszoomtoID[0].setStyle(selectedStyleSingle);
				var featureExtent = selectedFeatureszoomtoID[0].getGeometry().getExtent();
				  zoomtofeatureextent(featureExtent);
			}
	     
//			setTimeout( function(){


// set header depending on selectedFeatures.length

			var resultsheader = "";
	
	           	 resultsheader += '<div id="deselect"><a href="javascript:deselect();">Deselect these plans</a></div><br/><p><strong>Results - 1 plan:</strong><br />(hover mouse over each plan record to view extents).</p>';


// set results from selectedFeatures - display fields if they have content and provide a heading for each field

		        setResultsheader(resultsheader);

					var results = "";
			                var k;
			                for(k=0; k< 1; k++) {

						if (selectedFeatureszoomtoID.length > 0)

						results += '<div id="' + selectedFeatureszoomtoID[0].get("SURVEYID") + '" class="resultslist" data-layerid="' + selectedFeatureszoomtoID[0].get("SURVEYID") + '" >';

						if (selectedFeatureszoomtoID[0].get("PERSON") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>Person: </strong>' + selectedFeatureszoomtoID[0].get("PERSON") + '</p>';
						if (selectedFeatureszoomtoID[0].get("DESC_") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>Description: </strong>' + selectedFeatureszoomtoID[0].get("DESC_") + '<br/>';
						if (selectedFeatureszoomtoID[0].get("DATE_U") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>Date: </strong>' + selectedFeatureszoomtoID[0].get("DATE_U") + '</p>';
						if (selectedFeatureszoomtoID[0].get("PLACE") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>Location: </strong>' + selectedFeatureszoomtoID[0].get("PLACE") + '</p>';
						if (selectedFeatureszoomtoID[0].get("COUNTY_C") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>County: </strong>' + selectedFeatureszoomtoID[0].get("COUNTY_C") + '</p>';
						if (selectedFeatureszoomtoID[0].get("SUBJECT") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>Subject: </strong>' + selectedFeatureszoomtoID[0].get("SUBJECT") + '</p>';
						if (selectedFeatureszoomtoID[0].get("INV") && (selectedFeatureszoomtoID.length > 0))
							results += selectedFeatureszoomtoID[0].get("INV") + '</p>';
						if (selectedFeatureszoomtoID[0].get("COLOUR") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>B&W/Col?: </strong>' + selectedFeatureszoomtoID[0].get("COLOUR") + '</p>';
						if (selectedFeatureszoomtoID[0].get("MEDIA") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>Media: </strong>' + selectedFeatureszoomtoID[0].get("MEDIA") + '</p>';
						if (selectedFeatureszoomtoID[0].get("HEIGHT") && (selectedFeatureszoomtoID.length > 0))
							results += '<p><strong>Height: </strong>' + selectedFeatureszoomtoID[0].get("HEIGHT") + 
							' mm, <strong>Width: </strong>' + selectedFeatureszoomtoID[0].get("WIDTH") + ' mm</p>';
						results += '<p><strong>Shelfmark: </strong>' + selectedFeatureszoomtoID[0].get("SM") + '.' + selectedFeatureszoomtoID[0].get("PART") + ', '+ selectedFeatureszoomtoID[0].get("NO") + '</p>'; 

						results += '</div><hr2></hr2>'; 
			                
					}

					setResults(results);
				


//		}, 1000); // delay 3000 ms
		


	
}

// function to change the overlay layer

	var changeOverlay = function(index) {
	  if (map.getLayers().getLength() > 2) map.getLayers().removeAt(2);
	  map.getLayers().getArray()[1].setVisible(false);
	  map.getLayers().removeAt(1);
	  setResults();
	  map.getLayers().insertAt(1,overlayLayers[index]);
	  overlaySelected = overlayLayers[index];
	  overlaySelected.setVisible(true);
	}


// Change subject

	var changesubject = function(index) {
		subjectname = subjects[index].name;
		subjectsearchterm = subjects[index].searchterm;

	if (filterinprocess) { alert("Loading extents - please wait"); }
	else
		{
		filter();
		filterselection();
		}
	}


// initiates the date slider

	jQuery(document).ready(function(){
	
	   jQuery( "#slider-range" ).slider({
	      range: true,
	      min: 1600,
	      max: 1960,
	      values: [ 1610, 1950 ],
	      slide: function( event, ui ) {
	        jQuery( "#amount" ).val(  ui.values[ 0 ] + " - " + ui.values[ 1 ] );
	      }
	    });
	    jQuery( "#amount" ).val(   jQuery( "#slider-range" ).slider( "values", 0 ) +
	      " - " + jQuery( "#slider-range" ).slider( "values", 1 ) );
	  });


	document.getElementById('undated').addEventListener('change', function() {

			if (filterinprocess) { alert("Loading extents - please wait"); }
			else
				{
				filter();
				filterselection();
			}
	});

// initiates the base layer transparency slider

	jQuery(document).ready(function(){
	
	   jQuery( "#transparency" ).slider({
	      range: false,
	      min: 0,
	      max: 100,
	      value: 60,
	      slide: function( event, ui ) {
	        jQuery( "#transparency_val" ).val(  ui.value );
	      }
	    });
	    jQuery( "#transparency_val" ).val(   jQuery( "#transparency" ).slider( "value", 60 )  );

	  });

// changes the transparency of the base layer when the base layer transparency slider changes

	jQuery( "#transparency" ).on( "slide", function( event, ui ) 

	{ var base_transparency = jQuery( "#transparency" ).slider( "value");
		map.getLayers().getArray()[0].setOpacity(base_transparency /100);  
	} );

// filters the Stevenson GeoJSON features by subject and date

function filter() {

filterinprocess = true;
filterstart = false;
// console.log("filterstart = false");


if (document.getElementById('resultsheader').innerHTML.substring(1, 18) == 'div id="deselect"')




// create an empty array for the filtered GeoJSON features

		stevenson_geojson_updated_new = [];

// get full set of Stevenson geojson records

		stevenson_geojson_from_layer = map.getLayers().getArray()[1].getSource().getFeatures();

//		alert("stevenson source length: " + map.getLayers().getArray()[1].getSource().getFeatures().length);



// filter the stevenson_geojson_from_layer by subject - results put into filteredFeatures array

		filteredFeatures = [];
		if (document.getElementById('subjectselect').value == 0)
			{
			filteredFeatures = stevenson_geojson_from_layer;
			}
		else
			{

			subjectselectval = document.getElementById('subjectselect').value
			subjectsearchstring = subjects[subjectselectval].searchterm;
			filteredFeatures = stevenson_geojson_from_layer;
			filteredFeatures = jQuery.grep(stevenson_geojson_from_layer, function(n, i){
				 return n.get("SUBJECT") == subjectsearchstring;
			});
		}


// get max and min dates from date slider

		dates = [];
		dates = jQuery( "#slider-range" ).slider( "values");
		var minyear = dates[0];
		var maxyear = dates[1];



// ensure layer 2 has no features in source

		map.getLayers().getArray()[2].getSource().clear();

		filteredFeatures1 = [];
		filteredFeatures2 = [];
		filteredFeatures3 = [];
		filteredFeatures4 = [];
		filteredFeatures5 = [];

// jQuery grep command to filter features by Date

		filteredFeatures1 = jQuery.grep(filteredFeatures, function(n, i){
			 return n.get("DATE_MAX") > (minyear);
		});
	
		filteredFeatures2 = jQuery.grep(filteredFeatures1, function(n, i){
			 return n.get("DATE_MIN") < (maxyear);
		});

// if the #undated div is checked, include Undated features

		if (jQuery('#undated').is(":checked"))
			{

			filteredFeatures3 = jQuery.grep(filteredFeatures2, function(n, i){
				 return n.get("Undated") !== "Y";
			});

		}

		else

		{
		filteredFeatures3 = filteredFeatures2;
		}



// add filteredfeatures into layer 2 - filtering by GeomText extents, depending on zoom level, if zoomlevel radio button checked
// map.getLayers().getArray()[2] for pale blue unselectable features
// map.getLayers().getArray()[3] for dark blue selectable features


		zoomval = jQuery('input[name=zoomlevel]:radio:checked').val();
		mapzoom = map.getView().getZoom();

		if ((parseInt(zoomval)  == 1) && (mapzoom < 9))

			{

			map.getLayers().getArray()[2].getSource().clear();
			map.getLayers().getArray()[3].getSource().clear();

			filteredFeatures4 = jQuery.grep(filteredFeatures3, function(n, i){
				 return n.get("GeomText") !== "LARGE";
			});

			map.getLayers().getArray()[2].getSource().addFeatures(filteredFeatures4);

			filteredFeatures5 = jQuery.grep(filteredFeatures3, function(n, i){
				 return n.get("GeomText") == "LARGE";
			});

			var filteredFeatures5length = filteredFeatures5.length;

			map.getLayers().getArray()[3].getSource().addFeatures(filteredFeatures5);

			document.getElementById('zoom_statement').innerHTML = "Plans with <strong>large extents</strong> shown boldly and selectable on map. Zoom in to view plans with smaller extents.";

			zoomvalextent = "large";

			}

		else if ((parseInt(zoomval)  == 1) && (mapzoom > 8) && (mapzoom < 11))

			{

			map.getLayers().getArray()[2].getSource().clear();
			map.getLayers().getArray()[3].getSource().clear();

			filteredFeatures4 = jQuery.grep(filteredFeatures3, function(n, i){
				 return n.get("GeomText") !== "MEDIUM";
			});

			map.getLayers().getArray()[2].getSource().addFeatures(filteredFeatures4);

			filteredFeatures5 = jQuery.grep(filteredFeatures3, function(n, i){
				 return n.get("GeomText") == "MEDIUM";
			});

			var filteredFeatures5length = filteredFeatures5.length;

			map.getLayers().getArray()[3].getSource().addFeatures(filteredFeatures5);




			document.getElementById('zoom_statement').innerHTML = "Plans with <strong>medium extents</strong> shown boldly and selectable on map. Zoom in or out to view plans with smaller or larger extents.";

			zoomvalextent = "medium";

			}

		else if ((parseInt(zoomval)  == 1) && (mapzoom > 10))

			{

			map.getLayers().getArray()[2].getSource().clear();
			map.getLayers().getArray()[3].getSource().clear();

			filteredFeatures4 = jQuery.grep(filteredFeatures3, function(n, i){
				 return n.get("GeomText") !== "SMALL";
			});

			map.getLayers().getArray()[2].getSource().addFeatures(filteredFeatures4);

			filteredFeatures5 = jQuery.grep(filteredFeatures3, function(n, i){
				 return n.get("GeomText") == "SMALL";
			});

			var filteredFeatures5length = filteredFeatures5.length;

			map.getLayers().getArray()[3].getSource().addFeatures(filteredFeatures5);




			document.getElementById('zoom_statement').innerHTML = "Plans with <strong>small extents</strong> shown boldly and selectable on map. Zoom out to view plans with larger extents.";

			zoomvalextent = "small";

			}

		else  

			{

			map.getLayers().getArray()[2].getSource().clear();
			map.getLayers().getArray()[3].getSource().clear();

			var filteredFeatures5length = filteredFeatures3.length;


			map.getLayers().getArray()[3].getSource().addFeatures(filteredFeatures3);

			document.getElementById('zoom_statement').innerHTML = "Plans with <strong>small, medium and large extents</strong> shown boldly and selectable on map."

			zoomvalextent = "small, medium and large";

			}

// set layer 1 to be invisible

		map.getLayers().getArray()[1].setVisible(false);

			filterinprocess = false;
			// console.log("filterinprocess = false");

	}



// filters the selectedFeatures by subject and date

function filterselection() {

		if (map.getLayers().getArray()[4].getSource().getFeatures().length < 1 ) { return; }

// get full set of Stevenson geojson records

		else

		{

		stevenson_geojson_from_selection = map.getLayers().getArray()[3].getSource().getFeatures();

	// console.log("stevenson_geojson_from_selection length: " + stevenson_geojson_from_selection.length);

		setResults(''); 
		setResultsheader('<p>No plans selected - please click on a <strong>dark blue feature</strong> where you are interested in on the map to view details of plans</p>');

		map.getLayers().getArray()[4].getSource().clear();

// create an empty array for the filtered GeoJSON features

		stevenson_geojson_updated_new = [];


// filter the stevenson_geojson_from_layer by subject - results put into filteredFeatures array

		filteredselectedFeatures = [];
		if (document.getElementById('subjectselect').value == 0)
			{
			filteredselectedFeatures = selectedFeatures;
			}
		else
			{

			subjectselectval = document.getElementById('subjectselect').value
			subjectsearchstring = subjects[subjectselectval].searchterm;
			filteredselectedFeatures = stevenson_geojson_from_selection;
			filteredselectedFeatures = jQuery.grep(selectedFeatures, function(n, i){
				 return n.get("SUBJECT") == subjectsearchstring;
			});
		}


// get max and min dates from date slider

		dates = [];
		dates = jQuery( "#slider-range" ).slider( "values");
		var minyear = dates[0];
		var maxyear = dates[1];


		filteredselectedFeatures1 = [];
		filteredselectedFeatures2 = [];
		filteredselectedFeatures3 = [];
		filteredselectedFeatures4 = [];
		filteredselectedFeatures5 = [];

// jQuery grep command to filter features by Date

		filteredselectedFeatures1 = jQuery.grep(filteredselectedFeatures, function(n, i){
			 return n.get("DATE_MAX") > (minyear);
		});
	
		filteredselectedFeatures2 = jQuery.grep(filteredselectedFeatures1, function(n, i){
			 return n.get("DATE_MIN") < (maxyear);
		});

// if the #undated div is checked, include Undated features

		if (jQuery('#undated').is(":checked"))
			{

			filteredselectedFeatures3 = jQuery.grep(filteredselectedFeatures2, function(n, i){
				 return n.get("Undated") !== "Y";
			});

		}

		else

		{
		filteredselectedFeatures3 = filteredselectedFeatures2;
		}



// sort the results by DATE_MIN

			filteredselectedFeatures3.sort(function(a, b){
					   var nameA=a.get("DATE_MIN"), nameB=b.get("DATE_MIN")
					   if (nameA < nameB) //sort string ascending
					       return -1 
					   if (nameA > nameB)
					       return 1
					   return 0 //default return value (no sorting)
			
					})

// add selectedFeatures to map.getLayers().getArray()[4]

			map.getLayers().getArray()[4].getSource().addFeatures(filteredselectedFeatures3);

	// console.log("filteredselectedFeatures3 length: " + filteredselectedFeatures3.length);

// set header depending on selectedFeatures.length

			var resultsheader = "";
	
			if (filteredselectedFeatures3.length < 1)
				resultsheader += '';
	
			else if (filteredselectedFeatures3.length == 1)
		            resultsheader += '<div id="deselect"><a href="javascript:deselect();">Deselect these plans</a></div><br/><p><strong>Results - 1 plan:</strong><br />(hover mouse over each plan record to view extents).</p>';
			else if (filteredselectedFeatures3.length > 1)
	
		        resultsheader += '<div id="deselect"><a href="javascript:deselect();">Deselect these plans</a></div><br/><p><strong>Results - ' + filteredselectedFeatures3.length + ' plans:</strong><br />(hover mouse over each plan record to view extents).</p>';
	
// set results from selectedFeatures - display fields if they have content and provide a heading for each field

		        setResultsheader(resultsheader);

				  if (filteredselectedFeatures3.length > 0) {
					var results = "";
			                var k;
			                for(k=0; k< filteredselectedFeatures3.length; k++) {

						results += '<div id="' + filteredselectedFeatures3[k].get("SURVEYID") + '" class="resultslist" data-layerid="' + filteredselectedFeatures3[k].get("SURVEYID") + '" >';

						if (filteredselectedFeatures3[k].get("PERSON") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>Person: </strong>' + filteredselectedFeatures3[k].get("PERSON") + '</p>';
						if (filteredselectedFeatures3[k].get("DESC_") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>Description: </strong>' + filteredselectedFeatures3[k].get("DESC_") + '<br/>';
						if (filteredselectedFeatures3[k].get("DATE_U") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>Date: </strong>' + filteredselectedFeatures3[k].get("DATE_U") + '</p>';
						if (filteredselectedFeatures3[k].get("PLACE") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>Location: </strong>' + filteredselectedFeatures3[k].get("PLACE") + '</p>';
						if (filteredselectedFeatures3[k].get("COUNTY_C") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>County: </strong>' + filteredselectedFeatures3[k].get("COUNTY_C") + '</p>';
						if (filteredselectedFeatures3[k].get("SUBJECT") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>Subject: </strong>' + filteredselectedFeatures3[k].get("SUBJECT") + '</p>';
						if (filteredselectedFeatures3[k].get("INV") && (filteredselectedFeatures3.length > 0))
							results += filteredselectedFeatures3[k].get("INV") + '</p>';
						if (filteredselectedFeatures3[k].get("COLOUR") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>B&W/Col?: </strong>' + filteredselectedFeatures3[k].get("COLOUR") + '</p>';
						if (filteredselectedFeatures3[k].get("MEDIA") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>Media: </strong>' + filteredselectedFeatures3[k].get("MEDIA") + '</p>';
						if (filteredselectedFeatures3[k].get("HEIGHT") && (filteredselectedFeatures3.length > 0))
							results += '<p><strong>Height: </strong>' + filteredselectedFeatures3[k].get("HEIGHT") + 
							' mm, <strong>Width: </strong>' + filteredselectedFeatures3[k].get("WIDTH") + ' mm</p>';
						results += '<p><strong>Shelfmark: </strong>' + filteredselectedFeatures3[k].get("SM") + '.' + filteredselectedFeatures3[k].get("PART") + ', '+ filteredselectedFeatures3[k].get("NO") + '</p>'; 

						results += '</div><hr2></hr2>'; 
			                }

					setResults(results);
				
				  } else {

				        {setResults('No plans selected - please click on a <strong>dark blue feature</strong> where you are interested in on the map to view details of plans');}
				  }

			}


	}

// filter features if slider dates change

	jQuery( "#slider-range" ).on( "slidestop", function( event, ui ) 

	{
 			if (filterinprocess) { alert("Loading extents - please wait"); }
			else
				{
				filter();
				filterselection();
			} 
			} );


// the featureOverlay for the selected vector features

            var selectedFeatures = [];

// function to unselect previous selected features

            function unselectPreviousFeatures() {

                var i;
                for(i=0; i< selectedFeatures.length; i++) {
                    selectedFeatures[i].setStyle(null);
                }
                selectedFeatures = [];


                var i;
                for(i=0; i< selectedFeatureszoomtoID.length; i++) {
                    selectedFeatureszoomtoID[i].setStyle(null);
                }
                selectedFeatureszoomtoID = [];


// clear the map.getLayers().getArray()[4] layer for any previous features

		if (map.getLayers().getArray()[4].getSource().getFeatures().length > 0)
		{
		map.getLayers().getArray()[4].getSource().clear();
		}
            }


// function to unselect previous selected features from Results after mouse hover

            function unselectPreviousFeaturesFromResults()  {

		jQuery( "div.resultslist" ).css( "background-color", "white" );
		jQuery( "div.results" ).children().css( "background-color", "white" );

                var i;
                for(i=0; i< selectedFeaturesFromResults.length; i++) {
                   selectedFeaturesFromResults[i].setStyle(null);
                }
                selectedFeaturesFromResults = [];

            }

// function to unselect previous features and return the results and resultsheader divs back to original empty state

	function deselect()
		{
		unselectPreviousFeatures();
		setResults(''); 
		setResultsheader('<p>No plans selected - please click on a <strong>dark blue feature</strong> where you are interested in on the map to view details of plans</p>');
		updateUrl();
	}


// pan map to extent of selected feature

	function pantofeatureextent(extent) {

		 var x = extent[0] + (extent[2] - extent[0]) / 2; 
		 var y = extent[1] + (extent[3] - extent[1]) / 2; 
		
//	  	 var resolution = map.getView().getResolutionForExtent(extent, map.getSize());
//		 var zoom1 = map.getView().getZoomForResolution(resolution);
//		 var zoom = Math.round(zoom1 - 1);
		     

			map.getView().animate({
				center: [x , y ],
			//	zoom: zoom,
				duration: 800
			});

	}


// pan and zoom map to extent of selected feature

	function zoomtofeatureextent(extent) {

		 var x = extent[0] + (extent[2] - extent[0]) / 2; 
		 var y = extent[1] + (extent[3] - extent[1]) / 2; 
		
	  	 var resolution = map.getView().getResolutionForExtent(extent, map.getSize());
		 var zoom1 = map.getView().getZoomForResolution(resolution);
		 var zoom = Math.round(zoom1 - 1);
		     

			map.getView().animate({
				center: [x , y ],
				zoom: zoom,
				duration: 800
			});

	}


// function to select point features and display geoJSON information on them

	function displayFeatureInfo(pixel) {	

		 var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
			              feature.setStyle([
			                     selectedStyle
			                ]);

		          selectedFeatures.push(feature);
		        },   {

// only select features from map.getLayers().getArray()[3]

        			layerFilter: function(layer) {
				var selectable_layer = map.getLayers().getArray()[3];
           			return layer == selectable_layer;
				}
		        });

// sort the results by DATE_MIN

			selectedFeatures.sort(function(a, b){
					   var nameA=a.get("DATE_MIN"), nameB=b.get("DATE_MIN")
					   if (nameA < nameB) //sort string ascending
					       return -1 
					   if (nameA > nameB)
					       return 1
					   return 0 //default return value (no sorting)
			
					})

// add selectedFeatures to map.getLayers().getArray()[4]

			map.getLayers().getArray()[4].getSource().addFeatures(selectedFeatures);

// set header depending on selectedFeatures.length

			var resultsheader = "";
	
			if (selectedFeatures.length < 1)
				resultsheader += '';
	
			else if (selectedFeatures.length == 1)
		            resultsheader += '<div id="deselect"><a href="javascript:deselect();">Deselect these plans</a></div><br/><p><strong>Results - 1 plan:</strong><br />(hover mouse over each plan record to view extents).</p>';
			else if (selectedFeatures.length > 1)
	
		        resultsheader += '<div id="deselect"><a href="javascript:deselect();">Deselect these plans</a></div><br/><p><strong>Results - ' + selectedFeatures.length + ' plans:</strong><br />(hover mouse over each plan record to view extents).</p>';
	
// set results from selectedFeatures - display fields if they have content and provide a heading for each field

		        setResultsheader(resultsheader);

				  if (selectedFeatures.length > 0) {
					var results = "";
			                var k;
			                for(k=0; k< selectedFeatures.length; k++) {

						results += '<div id="' + selectedFeatures[k].get("SURVEYID") + '" class="resultslist" data-layerid="' + selectedFeatures[k].get("SURVEYID") + '" >';

						if (selectedFeatures[k].get("PERSON") && (selectedFeatures.length > 0))
							results += '<p><strong>Person: </strong>' + selectedFeatures[k].get("PERSON") + '</p>';
						if (selectedFeatures[k].get("DESC_") && (selectedFeatures.length > 0))
							results += '<p><strong>Description: </strong>' + selectedFeatures[k].get("DESC_") + '<br/>';
						if (selectedFeatures[k].get("DATE_U") && (selectedFeatures.length > 0))
							results += '<p><strong>Date: </strong>' + selectedFeatures[k].get("DATE_U") + '</p>';
						if (selectedFeatures[k].get("PLACE") && (selectedFeatures.length > 0))
							results += '<p><strong>Location: </strong>' + selectedFeatures[k].get("PLACE") + '</p>';
						if (selectedFeatures[k].get("COUNTY_C") && (selectedFeatures.length > 0))
							results += '<p><strong>County: </strong>' + selectedFeatures[k].get("COUNTY_C") + '</p>';
						if (selectedFeatures[k].get("SUBJECT") && (selectedFeatures.length > 0))
							results += '<p><strong>Subject: </strong>' + selectedFeatures[k].get("SUBJECT") + '</p>';
						if (selectedFeatures[k].get("INV") && (selectedFeatures.length > 0))
							results += selectedFeatures[k].get("INV") + '</p>';
						if (selectedFeatures[k].get("COLOUR") && (selectedFeatures.length > 0))
							results += '<p><strong>B&W/Col?: </strong>' + selectedFeatures[k].get("COLOUR") + '</p>';
						if (selectedFeatures[k].get("MEDIA") && (selectedFeatures.length > 0))
							results += '<p><strong>Media: </strong>' + selectedFeatures[k].get("MEDIA") + '</p>';
						if (selectedFeatures[k].get("HEIGHT") && (selectedFeatures.length > 0))
							results += '<p><strong>Height: </strong>' + selectedFeatures[k].get("HEIGHT") + 
							' mm, <strong>Width: </strong>' + selectedFeatures[k].get("WIDTH") + ' mm</p>';
						results += '<p><strong>Shelfmark: </strong>' + selectedFeatures[k].get("SM") + '.' + selectedFeatures[k].get("PART") + ', '+ selectedFeatures[k].get("NO") + '</p>'; 

						results += '</div><hr2></hr2>'; 
			                }

					setResults(results);
				
				  } else {

				        {setResults('No plans selected - please click on a <strong>dark blue feature</strong> where you are interested in on the map to view details of plans');}
				  }


							
	};

// function to highlight plans in the Results div and select / zoom to selected feature extent

	jQuery( document ).ready(function() {
		jQuery("#results").on("mouseenter", "div.resultslist", function(event) {
			var SurveyID = jQuery(this).attr('id');
			jQuery(this).css( "background-color", "rgba(255,0,0,0.4)" );
			var source = map.getLayers().getArray()[4].getSource();  

			source.forEachFeature( function(feature){
				if(feature.get('SURVEYID') === SurveyID)
				selectedFeaturesFromResults = [];
				selectedFeaturesFromResults.push(feature);
				});


	       		var i;
	                for(i=0; i< selectedFeaturesFromResults.length; i++) {
			 selectedFeaturesFromResults[0].setStyle(selectedStyleSingle);
				var featureExtent = selectedFeaturesFromResults[0].getGeometry().getExtent();
				  pantofeatureextent(featureExtent);
			}
	});

// function to unselect plans from the resultslist div when the mouse leaves it

	jQuery("#results").on("mouseleave", "div.resultslist", function(event) {
				unselectPreviousFeaturesFromResults(); 
	});     

});


// function to display information on numbers of maps covering mouse cursor

	function displayFeatureInfoOnHover(pixel) {	

		 var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
			              feature.setStyle([
			                     selectedStyle
			                ]);

		          selectedFeatures.push(feature);
		        },   {
        			layerFilter: function(layer) {
				var selectable_layer = map.getLayers().getArray()[3];
           			return layer == selectable_layer;
				}
		        });


			if (selectedFeatures.length < 1)
				document.getElementById('hover_results').innerHTML = '';
	
			else if (selectedFeatures.length == 1)
			document.getElementById('hover_results').innerHTML = selectedFeatures.length + " plan with a <strong>" + zoomvalextent + " extent</strong> covers mouse location."; 
			else if (selectedFeatures.length > 1)

			document.getElementById('hover_results').innerHTML = selectedFeatures.length + " plans with <strong>" + zoomvalextent + " extents</strong> cover mouse location."; 
								
	};

// listener to unselect any selected features and selects new ones on the mouse single click event 

	        map.on('singleclick', function(evt) {

// alter headers
			setResultsheader('<p>Selecting plans... please wait</p>');
			setResults(''); 

//			if (filterinprocess) { alert("Loading extents - please wait"); }
//			else
//				{

			pixel = evt.pixel;
			unselectPreviousFeatures();



			displayFeatureInfo(pixel);

//			}

		});

// listener to unselect any selected features and selects new ones on the mouse pointermove event - ie. the mouse cursor moving across the map

	        map.on('pointermove', function(evt) {
			if (document.getElementById('resultsheader').innerHTML.substring(1, 18) == 'div id="deselect"')
				{ 			
				document.getElementById('hover_results').innerHTML = ""; 
				return; 
				}
			else
				{
			      var pixel = evt.pixel;
			      unselectPreviousFeatures();
			      displayFeatureInfoOnHover(pixel);
				}

		});






// Change base layer

	var changemap = function(index) {
	  map.getLayers().getArray()[0].setVisible(false);
	  map.getLayers().removeAt(0);
	  map.getLayers().insertAt(0,baseLayers[index]);
	  map.getLayers().getArray()[0].setVisible(true);
	}



// add the OL ZoomSlider and ScaleLine controls

    map.addControl(new ol.control.ZoomSlider());
    map.addControl(new ol.control.ScaleLine({ units:'metric' }));

    map.removeInteraction(new ol.interaction.DoubleClickZoom({
		duration: 1000
		})
   	);	

// custom mouseposition with British National Grid and lat/lon

    var mouseposition = new ol.control.MousePosition({
            projection: 'EPSG:4326',
            coordinateFormat: function(coordinate) {
	    // BNG: ol.extent.applyTransform([x, y], ol.proj.getTransform("EPSG:4326", "EPSG:27700"), 
		var coord27700 = ol.proj.transform(coordinate, 'EPSG:4326', 'EPSG:27700');
		var templatex = '{x}';
		var outx = ol.coordinate.format(coord27700, templatex, 0);
		var templatey = '{y}';
		var outy = ol.coordinate.format(coord27700, templatey, 0);
		NGR = gridrefNumToLet(outx, outy, 6);
		var hdms = ol.coordinate.toStringHDMS(coordinate);
		if ((outx  < 0) || (outx > 700000 ) || (outy < 0) || (outy > 1300000 )) {
	        return '<strong>' + ol.coordinate.format(coordinate, '{x}, {y}', 4) + '&nbsp; <br/>&nbsp;' + hdms + ' &nbsp;'; 
		}
		else 
                { return '<strong>' + NGR + '</strong>&nbsp; <br/>' + ol.coordinate.format(coord27700, '{x}, {y}', 0) + 
			'&nbsp; <br/>' + ol.coordinate.format(coordinate, '{x}, {y}', 4) + '&nbsp; <br/>&nbsp;' + hdms + ' &nbsp;'; }
            	}
    });

    map.addControl(mouseposition);


// populates the resultsheader div on the right with default text 

	function setResultsheader(str) {
	//    if (!str) str = '<p>No plans selected - please click on where you are interested in on the map to the left to view details of plans</p>';
	    document.getElementById('resultsheader').innerHTML = str;
	}

// resultsheader += '<p>No plans selected - please click on where you are interested in on the map to the left to view details of plans</p>';

	setResultsheader('<p>No plans selected - please click on a <strong>dark blue feature</strong> where you are interested in on the map to view details of plans</p>');

	function setResults(str) {
	    if (!str) str = "";
	    document.getElementById('results').innerHTML = str;
	}


// listener on changes on map.getLayers().getArray()[3] and when features are present, change 'loading_results' div

            stevenson_geojson_layer3.getSource().on('change', function(event) {

		  if (map.getLayers().getArray()[3].getSource().getFeatures().length > 0) {
			document.getElementById('loading_results').innerHTML  = "";
//                console.log("layer 3 loaded");
		  }


	    });


// listener on map.getLayers().getArray()[1] - when features are loaded from GeoJSON initiate filter()

	    var stevenson_geojson_layer_ready;

            stevenson_geojson_layer.getSource().on('change', function(event) {

		  if (map.getLayers().getArray()[1].getSource().getFeatures().length > 1900) {
			stevenson_geojson_layer_ready = "true";

		  }

		if ((stevenson_geojson_layer_ready) && (filterstart))

			setTimeout( function(){
				filter();


				if (currentID)
				if (currentID  !== '0') 
				{
					zoomtoID(currentID);
				}



			}, 1000); // delay 1000 ms



	    });




// listener on map moveend to execute filter if zoom level changes 

	var currZoom = map.getView().getZoom();
	map.on('moveend', function(e) {
//	updateUrl();
	  var newZoom = map.getView().getZoom();
	  if (currZoom != newZoom) {
	   // console.log('zoom end, new zoom: ' + newZoom);
	    currZoom = newZoom;

		if ((newZoom > 7) && (newZoom < 12))
		{
		filter();
		}


	  }

	});


// OSMNames Gazetteer - further details at: https://osmnames.org/api/ 

// This takes the selected name from the OSMNames gazetteer and zooms the map to the location
// This currently searches names in New Zealand - remove the /nz/ suffix for global coverage

	var autocomplete = new kt.OsmNamesAutocomplete(
          'gaz', 'https://search.osmnames.org/gb/', '6mugkTijDnj5zw1Kh7Q5');

// Replace '6mugkTijDnj5zw1Kh7Q5' with your own API key at: https://cloud.maptiler.com/ 

      	autocomplete.registerCallback(function(item) {
		
// takes the geographic extent of the feature and converts it from EPSG:4326 to EPSG:3857		

           extent = ol.extent.applyTransform(item.boundingbox, ol.proj.getTransform("EPSG:4326", "EPSG:3857"));
		
var x = extent[0] + (extent[2] - extent[0]) / 2; 
	 var y = extent[1] + (extent[3] - extent[1]) / 2; 
	
  	 var resolution = map.getView().getResolutionForExtent(extent, map.getSize());
	 var zoom1 = map.getView().getZoomForResolution(resolution);
	 var zoom = Math.round(zoom1);

     
	 if ((zoom > 15 ) || (zoom < 3) || (isNaN(zoom)))
		{ zoom = 15; }


	      function flyTo(location, done) {
	        var duration = 3000;
	      //  var zoom = map.getView().getZoom();
	        var parts = 2;
	        var called = false;
	        function callback(complete) {
	          --parts;
	          if (called) {
	            return;
	          }
	          if (parts === 0 || !complete) {
	            called = true;
	            done(complete);
	          }
	        }
	        map.getView().animate({
	          center: location,
	          duration: duration
	        }, callback);
	        map.getView().animate({
	          zoom: zoom - 1,
	          duration: duration / 2
	        }, {
	          zoom: zoom,
	          duration: duration / 2
	        }, callback);
	      }

	if (parseInt(currentZoom) > 8)
		{
		flyTo([x, y], function() {});
		}
	else
		{

		//	 // alert("x: " + x + ", y: " + y + ", res: " + resolution + ", zoom: " + zoom);
			
			map.getView().animate({
				center: [x , y ],
				zoom: zoom,
			        duration: 2000
			});
		}
	}
    );

