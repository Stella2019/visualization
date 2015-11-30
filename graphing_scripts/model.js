function TimeSeriesData(controller) {
    this.controller = controller;
    
    this.collections = {};
    this.collection_names = [
        "Paris Shooting",
        "Paris Collection 2",
        "Paris Shooting - 3 - New Terms",
        "SahafiHotelAttack",
        "Sinai Plane Crash",
        "NORAD blimp on the loose",
        "Earthquake in Pakistan and Afghanistan", 
        "Hurricane Patricia - Spanish terms", 
        "Flooding from Patricia",
        "Hurricane Patricia", 
        "Wilfrid Laurier Lockdown",
        "Black Lives Matter Collection",
        "Ankara Bombing",
        "Hurricane Oho",
        "Doctors without Borders",
        "Townhall gunmen",
        "umpqua college shooting",
        "Hurricane Joaquin - hurricane terms",
        "Hurricane Joaquin - flooding terms",
        "Yemen mosque bombing",
        "Chile", 
        "Flash Flood",
        "California Valley Fire",
        "Grand Mosque accident",
        "Refugee crisis",
        "Karachi Explosion",
        "Chicago Shooting",
        "Western WA storms",
        "Tropical Storm Erika",
        "WA Wildfires - August",
        "Cotopaxi volcano", 
        "FAA outage",
        "Chemical Spill - August 2015", 
        "Alaska Earthquake - July 26",
        "Navy Shooting",
        "NYSE Stock Exchange Cant Exchange",
        "India Earthquake"
    ];
    
    this.data_raw = [];
    this.data_stacked = [];
    this.series_data = [];
    this.total_byTime = [];
}

TimeSeriesData.prototype = {
    compareCollections: function(a, b) {
        if(a.starttime < b.starttime) 
            return -1;
        if(a.starttime > b.starttime)
            return 1;
        return 0;
    },
    compareSeries: function (a, b) {
         if(a.sum !== undefined && b.sum !== undefined)
            return b.sum - a.sum;
        return a.order - b.order;
    },
    loadCollections: function (args) {
        d3.json("capture_stats/collections.json", function(error, collections_file) {
            if (error) throw error;

            // Add collections
            collections_file.sort(this.compareCollections);
            collections_file.reverse();
            
            this.collections = collections_file;

            this.collection_names = this.collections.map(function(collection) {
                return collection.name;
            });
            
            args.callback(this.collection_names);
        });
    },
    loadTimeseries: function() {

        d3.json("capture_stats/" + collection + unique_suffix + ".json", function(error, data_file) {
            if (error) throw error;

            // Get the timestamps
            timestamps = Object.keys(data_file).sort();

            // Get the keywords
            keywords = d3.keys(data_file[timestamps[0]]).filter(function (key) {
                return key !== "timestamp" && key !== 'tweets';
            });

            // Parse dates and ints
            data_raw = [];
            for (var i = 0; i < timestamps.length; i++) {
                timestamp = timestamps[i];
                entry = {
                    timestamp: parseDate(timestamp),
                    tweets: data_file[timestamp]["tweets"]
                };
                keywords.map(function(keyword) {
                    entry[keyword] = parseInt(data_file[timestamp][keyword]);
                });
                data_raw.push(entry);
            }

            // Start generate series's data
            keywords_selected = {};
            series_data = [];
            keywords.forEach(function(name, i) {
                keywords_selected[name] = true; 
                series_data.push({
                    name: name,
                    id: simplify(name),
                    order: (i + 1) * 100,
                    shown: true, // replaced the map keywords_selected with this at some point
                    sum: data_raw.reduce(function(cur_sum, datapoint) {
                        return cur_sum + datapoint[name];
                    }, 0)
                });
            });

            // Build Legend
            buildLegend();

            // Set Time Domain and Axis
            var x_min = timestamps[0];
            var x_max = timestamps[timestamps.length - 1];
            focus.x.domain([x_min, x_max]).clamp(true);
            context.x.domain([x_min, x_max]);

            // Clear brush
            brush.clear();
            plot_area.svg.selectAll('.brush').call(brush);

            prepareData();
        });
    }
}