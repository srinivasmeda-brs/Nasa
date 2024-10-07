/**
 Author:    Build Rise Shine with Nyros (BRS)
 Created:   11.05.2022
 Library / Component: Script file
 Description: Logic behind the app (fetching the data from the API)
 (c) Copyright by BRS with Nyros.
 **/

 const nasa_eonet_endpoint = "https://eonet.gsfc.nasa.gov/api/v3";
 const geoCodingUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
 const sourcesList = [
     "AVO", "ABFIRE", "AU_BOM", "BYU_ICE", "BCWILDFIRE", "CALFIRE",
     "CEMS", "EO", "FEMA", "FloodList", "GDACS", "GLIDE", "InciWeb",
     "IDC", "JTWC", "MRR", "MBFIRE", "NASA_ESRS", "NASA_DISP",
     "NASA_HURR", "NOAA_NHC", "NOAA_CPC", "PDC", "ReliefWeb",
     "SIVolcano", "NATICE", "UNISYS", "USGS_EHP", "USGS_CMT",
     "HDDS", "DFES_WA"
 ];
 
 const mapbox_accesstoken = 'pk.eyJ1IjoicGFyaXNyaSIsImEiOiJja2ppNXpmaHUxNmIwMnpsbzd5YzczM2Q1In0.8VJaqwqZ_zh8qyeAuqWQgw';
 mapboxgl.accessToken = mapbox_accesstoken;
 
 let map = new mapboxgl.Map({
     container: 'map',
     style: 'mapbox://styles/mapbox/streets-v12',
     zoom: 1,
     projection: 'equirectangular'
 });
 
 let event_link = '';
 let geojson = { 'type': 'FeatureCollection' };
 let markers = [];
 let markerList = [];
 let geoData = [];
 let event_title;
 let workingEoNetEvents = ['Sea and Lake Ice', 'Volcanoes', 'Wildfires'];
 
 $(document).ready(() => {
     initializeDatePicker();
     fetchEvents();
     fetchCategories();
 });
 
 function initializeDatePicker() {
     $(".datepicker").focus(function() {
         const datepicker = this;
         const picker = new Pikaday({ // Assuming you have included Pikaday for date selection
             field: datepicker,
             format: 'YYYY-MM-DD',
             yearRange: [1900, new Date().getFullYear()],
             onSelect: function(date) {
                 datepicker.value = this.getMoment().format('YYYY-MM-DD');
             }
         });
         picker.show();
     });
 }
 
 function fetchCategories() {
     $.getJSON(nasa_eonet_endpoint + "/categories")
         .done(data => {
             const eventList = $("#eventList");
             eventList.empty(); // Clear previous entries
 
             // Filter matching events
             const filteredCategories = data.categories.filter(event => 
                 workingEoNetEvents.includes(event.title)
             );
 
             filteredCategories.forEach(event => {
                 const listItem = `
                     <li class="event">
                         <div class='event-desc'>
                             <h3><a href='#' onclick='showLayers("${event.title}", "${event.link}");'>${event.title}</a></h3>
                             <p>House: ${event.description}</p>
                         </div>
                         <img src="assets/img/categories/${event.id}.png" alt="${event.title}">
                     </li>
                 `;
                 eventList.append(listItem);
             });
         })
         .fail(error => console.error('Error fetching categories:', error));
 }
 
 function fetchEvents() {
     $("#eventTitle").empty();
     $("#eventSelect").show();
     $("#layerSelect").hide();
     $("#map").hide();
     $("#startDate").val('');
     $("#endDate").val('');
 }
 
 function searchByDate() {
     const startDate = $('#startDate').val();
     const endDate = $('#endDate').val();
     const limit = $('#limit').val();
     showLayers(event_title, event_link, startDate, endDate, limit);
 }
 
 function showLayers(title, link, startDate, endDate, limit = 10) {
     event_link = link || event_link;
     event_title = title || event_title;
 
     $("#eventTitle").html(' > ' + event_title);
 
     let queryParams = $.param({ source: sourcesList.join(','), limit: limit });
 
     geoData = [];
     markers = [];
 
     if (startDate) queryParams += `&start=${startDate}`;
     if (endDate) queryParams += `&end=${endDate}`;
 
     $("#eventSelect").hide();
     $("#layerSelect").show();
     $("#map").show();
 
     fetch(`${event_link}?${queryParams}`)
         .then(response => response.json())
         .then(linkData => {
             let categoryData = '';
             (linkData?.events || []).forEach(layerItem => {
                 const location = layerItem.geometry[0].coordinates;
                 geoData.push({ coordinates: location, title: layerItem.title, url: layerItem.sources[0].url });
                 categoryData += `<dd><a onclick='showMap(${location});'>${layerItem.title}</a></dd>`;
             });
 
             $("#layerList").html(categoryData);
             displayMap();
         });
 }
 
 function showMap(lat, lng) {
     const fm = markers.find(e => JSON.stringify(e?.geometry?.coordinates) === JSON.stringify([lat, lng]));
     const popupContent = `
         <div class='w-100'>
             <h5>${fm['properties']['message']}</h5>
             <h6>${fm['properties']['coordinatesData']}</h6>
             <a class='a-ellips' target='_blank' href="${fm['properties']['url']}">${fm['properties']['url']}</a>
         </div>
     `;
 
     // Remove existing popups
     map._popups.forEach(p => p.remove());
     new mapboxgl.Popup({ offset: 25 }).setLngLat(fm?.geometry?.coordinates).setHTML(popupContent).addTo(map);
 }
 
 async function displayMap() {
     markerList.forEach(markerPt => markerPt.remove());
 
     geoData.forEach(geoPt => {
         let markerData = {
             type: 'Feature',
             properties: {
                 message: geoPt.title,
                 url: geoPt.url,
                 iconSize: [60, 60],
                 iconHoverSize: [70, 70]
             },
             geometry: {
                 type: 'Point',
                 coordinates: geoPt.coordinates
             }
         };
 
         markers.push(markerData);
         geojson.features = markers;
 
         const ml = new mapboxgl.Marker().setLngLat(geoPt.coordinates);
         ml.getElement().addEventListener('click', function() {
             fetch(`${geoCodingUrl}/${geoPt.coordinates[0]},${geoPt.coordinates[1]}.json?access_token=${mapbox_accesstoken}`)
                 .then(response => response.json())
                 .then(data => {
                     const place_name = data.features[0]?.place_name || '';
                     const popup_html = `
                         <div class='w-90'>
                             <h5>${geoPt.title}</h5>
                             <h6>${place_name}</h6>
                             <a class='a-ellips' target='_blank' href="${geoPt.url}">${geoPt.url}</a>
                         </div>
                     `;
                     const popup = new mapboxgl.Popup({ offset: 25 }).setLngLat(geoPt.coordinates).setHTML(popup_html);
                     popup.addTo(map);
                 });
         });
 
         markerList.push(ml.addTo(map));
     });
 }
 
 function setTheme(theme) {
     document.documentElement.style.setProperty('--primary-color', theme);
     localStorage.setItem('nasa-eonet-theme', theme);
 }
 
 // Set the theme from local storage or default
 setTheme(localStorage.getItem('nasa-eonet-theme') || '#1A4B84');
 