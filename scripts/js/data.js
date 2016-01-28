/*global data, disp, legend, util, options, d3, console */

function Stream(args) {
    var self = this;

    // Defaults
    self.name = 'r' + Math.floor(Math.random() * 1000000 + 1);
    self.url = "";
    self.post = {};
    self.time_res = 1; // 1 Hour
    self.progress_div = '#timeseries_div';
    self.progress_button = false;
    self.chunk_index = 0;
    self.time_min = options.time_min.min;
    self.time_max = options.time_max.max;
    self.failure_msg = 'Problem with data stream';
    self.on_chunk_finish = function () {};
    self.on_finish = function () {};
    
    // Save args  
    Object.keys(args).map(function (item) {
        this[item] = args[item];
    }, this);
}
Stream.prototype = {
    start: function () {
        this.time_chunks = [];
        var timestamp;
        for (timestamp = new Date(this.time_min);
                timestamp < this.time_max;
                timestamp.setMinutes(timestamp.getMinutes() + 60 * this.time_res)) {
            this.time_chunks.push(util.formatDate(timestamp));
        }
        this.time_chunks.push(util.formatDate(this.time_max));

        // Start progress bar
        disp.startProgressBar(this.name,
                              this.progress_div,
                              this.progress_button);

        this.chunk();
    },
    chunk: function () {
        // If we are at the max, end
        if (this.chunk_index >= this.time_chunks.length - 1) {
            // Load the new data
            this.on_finish();

            // End the progress bar and stop function
            disp.endProgressBar(this.name);
            return;
        } else if(this.chunk_index < 0) {
            // End prematurely
            disp.endProgressBar(this.name);
            return;
        }

        this.post.time_min = this.time_chunks[this.chunk_index];
        this.post.time_max = this.time_chunks[this.chunk_index + 1];

        data.callPHP(this.url, this.post,
                     this.chunk_success.bind(this),
                     this.chunk_failure.bind(this));
    },
    chunk_success: function (file_data) {
        if (file_data.includes('<b>Notice</b>')) {
            console.debug(file_data);

            // Abort
            this.chunk_failure();
            return;
        }

        // Update the progress bar
        var completed = this.chunk_index + 1;
        var total = this.time_chunks.length - 1;
        disp.updateProgressBar(this.name, Math.floor(completed / total * 100));

        this.on_chunk_finish(file_data);

        // Start loading the next batch
        this.chunk_index = this.chunk_index + 1;
        this.chunk();
    },
    chunk_failure: function (a, b, c) {
        console.log(a, b, c);
        disp.alert(this.failure_msg);
        disp.endProgressBar(this.name);
    },
    stop: function() {
        this.chunk_index = -100;
    }
};

function Data() {
    var self = this;
    
    // Time
    self.time = {
        timestamps: [],
        collection_min: new Date(),
        collection_max: new Date(),
        min: new Date(),
        max: new Date()
    };
    self.timestamps = {};
    self.timestamps_nested = {};
    
    // Collection info
    self.collection = {};
    self.collections = {};
    self.collection_names = [];
    
    // Data
    self.file = [];
    self.stacked = {}; // formerly data_stacked
    self.series = {}; // formerly series_data
    self.series_byID = {};
    self.all = {}; // formerly data_raw
    self.total_of_series = []; // formerly total_byTime
    self.total_tweets = []; // formerly context_byTime
    
    // Series
    self.stack =  d3.layout.stack()
        .values(function (d) { return d.values; })
        .x(function (d) { return d.timestamp; })
        .y(function (d) { return d.value; })
        .out(function (d, y0, y) { 
            d.y0 = y0;
            d.y = y;
            d.value0 = y0;
        })
        .order("reverse");
    
    // Streams
    self.streamTweetCounts = null;
}
Data.prototype = {
    loadCollections: function () {
        // Collection selection
        data.callPHP('collection/getEvents', {},
                     data.parseCollectionsFile);
    },
    parseCollectionsFile: function (collections_file) {
        // Add collections
        collections_file = JSON.parse(collections_file);
        collections_file.sort(util.compareCollections);
        collections_file.reverse();
        data.collections = collections_file;

        
        // Format collection data
        data.collections.map(function (collection) {
            // Keywords
            collection.Keywords = collection.Keywords.trim().split(/,[ ]*/);
            collection.OldKeywords = collection.OldKeywords.trim().split(/,[ ]*/);
            if (collection.OldKeywords.length == 1 && collection.OldKeywords[0] == "")
                collection.OldKeywords = [];
            
            // Name
            if (!('DisplayName' in collection) || !collection['DisplayName'] || collection['DisplayName'] == "null")
                collection.DisplayName = collection.Name;
               
            // Time
            collection.StartTime = util.date(collection.StartTime);
//            collection.StartTime.setMinutes(collection.StartTime.getMinutes()
//                                           -collection.StartTime.getTimezoneOffset());
            collection.Month = util.date2monthstr(collection.StartTime);
            if (collection.StopTime) {
                collection.StopTime = util.date(collection.StopTime);
                if (collection.StartTime.getMonth() != collection.StopTime.getMonth() ) 
                    collection.Month += ' to ' + util.date2monthstr(collection.StopTime);
            } else {
                collection.StopTime = "Ongoing";
                collection.Month += '+';
            }
            collection.DisplayName += ' ' + collection.Month;
        });

        
        // Make nicer collection names
        data.collection_names = data.collections.map(function (collection) {
            return collection.DisplayName;
        });
        
        options.buildCollections();

        // Initialize Legend
        legend = new Legend();
        legend.init();

        data.setCollection();
    },
    setCollection: function () {
        var collection_id = options.collection.get();
        
        data.collection = data.collections.reduce(function (collection, candidate) {
            if (collection.ID == collection_id)
                return collection;
            return candidate;
        }, {});
        
        disp.setTitle();
        
        data.loadCollectionData();
    },
    loadCollectionData: function () {
        // If there is no collection information, end, we cannot do this yet
        if ($.isEmptyObject(data.collection)) {
            return;
        }

        // Clear the raw data objects
        data.file = [];
        data.all = {};
        
        // Get times from collection
        data.time.collection_min = new Date(data.collection.StartTime);
        if(data.collection.StopTime == "Ongoing") {
            data.time.collection_max = new Date();
        } else {
            data.time.collection_max = new Date(data.collection.StopTime);
        }
        
        // Get times to load
        if(options.time_limit.is('all')) {
            data.time.min = new Date(data.time.collection_min);
            data.time.max = new Date(data.time.collection_max);
        } else {
            var time_limit = options.time_limit.get();
            var sign = time_limit.slice(0, 1) == '-' ? -1 : 1;

            time_limit = time_limit.slice(-2);
            var hours_diff = 0;

            if (time_limit == '3h') {
                hours_diff = 3;
            } else if (time_limit == '2h') { // 12h, but we sliced it
                hours_diff = 12;
            } else if(time_limit == '1d') {
                hours_diff = 24;
            } else if(time_limit == '3d') {
                hours_diff = 24 * 3;
            } else if(time_limit == '1w') {
                hours_diff = 24 * 7;
            }

            if(sign == -1) {
                data.time.min = new Date(data.time.collection_max);
                data.time.min.setHours(data.time.min.getHours() + hours_diff * sign);
                
                data.time.max = new Date(data.time.collection_max);
            } else {
                data.time.min = new Date(data.time.collection_min);
                
                data.time.max = new Date(data.time.collection_min);
                data.time.max.setHours(data.time.max.getHours() + hours_diff * sign);
            }
        }
        
        // Load information about the rumors related to the collection
        data.loadRumors();
        
//        data.startLoadingCollection();
        d3.select('#choose_collection button')
            .attr('disabled', true);
        
        // Send a signal to start loading the collection
        var args = {
            name: 'load_collection',
            url: 'timeseries/get',
            post: {event_id: data.collection.ID},
            time_min: new Date(data.time.min),
            time_max: new Date(data.time.max),
            time_res: 3,
            failure_msg: 'Error loading data',
            on_finish: data.parseCSVData,
            on_chunk_finish: function(file_data) {
                file_data = d3.csv.parse(file_data);
                data.file = data.file.concat(file_data);
            }
        };
        
        if(data.streamTweetCounts)
            data.streamTweetCounts.stop();
        data.streamTweetCounts = new Stream(args);
        data.streamTweetCounts.start();
    },
    loadRumors: function() {
        data.callPHP('collection/getRumors',
                     {event_id: data.collection.ID},
                     data.parseRumorsFile);
    },
    parseRumorsFile: function(filedata) {
        filedata = JSON.parse(filedata);
        
        data.rumors = filedata;
        
        // Populate the list of options
        options.buildRumors();
    },
    setRumor: function() {
        var rumor_id = options.rumor.get();
        
        data.rumor = data.rumors.reduce(function(rumor, candidate) {
            if(rumor.ID == rumor_id)
                return rumor;
            return candidate
        }, {});
        
        // No future callbacks from this
    },
    loadDataFile: function(url_base, time_chunks, index) {
        // If we are at the max, end
        if(index >= time_chunks.length - 1) {
            // Set the text to rendering
            d3.select('#load_collection_progress')
                .text('Rendering Chart');
            
            // Load the new data
            setTimeout(function() {
            
                // End the progress bar and stop function
                disp.endProgressBar('load_collection');
                d3.select('#choose_collection button')
                    .attr('disabled', null);
            }, 1000);
                
            return;
        }
    },
    parseCSVData: function() {
        d3.select('#choose_collection button')
            .attr('disabled', null);
        
        // Get the timestamps
        data.timestamps = util.lunique(data.file.map(function(d) { return d.Time; }));

        if(data.timestamps.length == 0)
            data.timestamps = [util.formatDate(new Date())];
        var keywords = Array.from(new Set(data.file.map(function(d) {return d.Keyword})));
        legend.series_ids.Keyword = keywords.map(function(d) {
            return util.simplify(d) });
        legend.series_names.Keyword = keywords;
//        legend.series_names_nt.Keyword = keywords.filter(
//            function(name){ return name != '_total_'; });

        // Fill in missing timestamps
        data.time.min = util.date(data.timestamps[0]);
        data.time.max = util.date(data.timestamps[data.timestamps.length - 1]);
        if(options.time_limit.get().slice(0, 1) == '-')
            last_timestamp = util.formatDate(new Date());

        var new_timestamps = [];
        for(var timestamp = new Date(data.time.min);
            timestamp <= data.time.max;
            timestamp.setMinutes(timestamp.getMinutes() + 1)) {
            new_timestamps.push(util.formatDate(timestamp));
        }
        data.timestamps = new_timestamps;
        
        data.all = [];
        var types = legend.series_names['Tweet Type'];
        var foundins = legend.series_names['Found In'];
        
        for(row in data.file) {
            var i_t = data.timestamps.indexOf(data.file[row]['Time']);
            var i_f = foundins.indexOf(data.file[row]['Found_In']);
            var i_k = keywords.indexOf(data.file[row]['Keyword']);
            var i_d = data.file[row]['Distinct'] == 1 ? 0 : 1;
            
            if(typeof data.file[row] !== 'object')
                continue;

            types.forEach(function(tweet_type) {
                var i_y = types.indexOf(tweet_type);
                data.all.push([i_y, i_d, i_f, i_k, i_t,
                    parseInt(data.file[row][tweet_type])]);
            });
        }

        // Clear the data file object (since it takes up a lot of space)
        data.file = [];
        
        // Set Time Domain and Axis
        disp.focus.x.domain(  [data.time.min, data.time.max]).clamp(true);
        disp.context.x.domain([data.time.min, data.time.max]);

        // Clear brush
        disp.brush.clear();
        disp.plot_area.svg.selectAll('.brush').call(disp.brush);

        data.initializeSeries();
    },
    initializeSeries: function() {
        data.series = legend.series_names['Keyword']
            .map(function(name, i) {
            var entry = {
                display_name: name,
                name: name,
                id: util.simplify(name),
                order: (i + 1) * 100 + 30000, // since it is the last main series type
                shown: true
            };
            
            // Get rumor information
            if(name.includes('_rumor_')) {
                var rumor = name.substring(7);
                rumor = data.rumors.reduce(function(cur, cand) {
                    if(cand.ID == rumor)
                        return cand;
                    return cur;
                }, {});
                if(rumor) {
                    entry.display_name = rumor.Name;
                    entry.rumor = rumor;
                    entry.isRumor = true;
                }
            }
            
            // Find if the entry is in either keyword list
            entry.isKeyword = data.collection
                .Keywords.reduce(function(prev, keyword) {
                return prev |= keyword.toLowerCase().replace('#', '') == entry.name.toLowerCase().replace('#', '');
            }, false);
            entry.isOldKeyword = data.collection
                .OldKeywords.reduce(function(prev, keyword) {
                return prev |= keyword.toLowerCase().replace('#', '') == entry.name.toLowerCase().replace('#', '');
            }, false);
            
            // Get Legend Type
            entry.type = legend.key_data_byID['added'].label;
            if(entry.isKeyword) {
                entry.type = legend.key_data_byID['capture'].label;
            } else if(entry.isOldKeyword) {
                entry.type = legend.key_data_byID['removed'].label;
            } else if(entry.isRumor) {
                entry.type = legend.key_data_byID['rumor'].label;
            }
            entry.category = 'Keyword';
            
            return entry;
        });
        
        // Rest of the series (Tweet Type, Found In, Distinct)
        legend.series_cats.forEach(function(category, j) {
            if(category == 'Keyword')
                return; // Already done
            
            var series_names = legend.series_names[category];
            var series_ids = legend.series_ids[category];
            series_names.forEach(function(name, i) {
                var entry = {
                    display_name: name,
                    name: name,
                    id: series_ids[i],
                    order: (i + 1) * 100 + j * 10000,
                    shown: true,
                    type: category,
                    category: category
                };

                data.series.push(entry);
            });
        });
        
        // Make alternative indices
        data.series_byID = {};
        data.series_byCat = {};
        legend.series_cats.forEach(function(category) {
            data.series_byCat[category] = [];
        });
        data.series_names = data.series.map(function(series) {
            data.series_byID[series.id] = series;
            data.series_byCat[series.category].push(series);
            return series.name;
        });
        
        // Start data series
//        data.loadNewSeriesData();

        // Populate Legend
        legend.series_cats.forEach(legend.populate);

        // Finish preparing the data for loading
        data.prepareData();  
    },
    prepareData: function() {
        
        // If we haven't loaded the data yet, tell the user and ask them to wait
        if(!data.all) {
            disp.alert('No data loaded', 'danger');
            return;
        }
        legend.series_cats.forEach(data.nestDataTotals);
        data.nestDataTotals('timestamps', 4);
        data.recalculateShown();
        data.getCategorySubtotals();
        
//        data.total_of_series = data_ready.map(function(datum) {
//            return Math.max(data.series_names.reduce(function(running_sum, word) {
//                return running_sum += datum[word];
//            }, 0), 1);
//        });
//        data.total_tweets = data_ready.map(function(datum) {
//            return {timestamp: datum.timestamp, value: datum['_total_']};
//        });

        // Reorder by total size
        data.series.sort(legend.cmp);
        legend.container_keywords.selectAll('div.legend_entry').sort(legend.cmp_byID);
        disp.setColors();

        // Set Time Domain and Axis appropriate to the resolution
        disp.setContextTime(data.timestamps_nested[0],
            data.timestamps_nested[data.timestamps_nested.length - 1]);

        disp.setFocusAxisLabels();

        // Display values on the context chart
        disp.contextChart();
        
        data.stackTimeseries();
        
        // Display the data
        disp.display();
    },
    recalculateShown: function() {
        var addToShownList = function(list, id, i) {
            if(data.series_byID[id].shown) {
                list.push(i);
            }
            return list;
        }
        
        data.shown = {
            y: legend.series_ids['Tweet Type']
                        .reduce(addToShownList, []),
            d: legend.series_ids['Distinctiveness']
                        .reduce(addToShownList, []),
            f: legend.series_ids['Found In']
                        .reduce(addToShownList, []),
            k: legend.series_ids['Keyword']
                        .reduce(addToShownList, [])
        }
        
        
        // Handle this later
//        if(shown.f.length == 
//           legend.series_names_nt['Found In'].length)
//            shown.f = [0];
//        if(shown.k.length == 
//           legend.series_names_nt['Keyword'].length)
//            shown.k = ['_total_'];
    },
    getCategorySubtotals: function() {
        // Get nested timestamps
        data.timestamps_nested = d3.nest()
            .key(data.timeInterpolate)
            .entries(data.timestamps);
        data.timestamps_nested = data.timestamps_nested.map(function(d) {
            return new Date(d.key);
        });
        data.timestamps_nested_int =
            data.timestamps_nested.map(function(d) {
            return d.getTime();
        });

        // Get nested data
        legend.series_cats.forEach(data.nestDataSubtotals);
    },
    timeInterpolate: function(d) {
        var time = util.date(d);
        if(options.resolution.is('tenminute'))
            time.setMinutes(Math.floor(time.getMinutes() / 10) * 10);
        if(options.resolution.is('hour') || options.resolution.is("day"))
            time.setMinutes(0);
        if(options.resolution.is("day"))
            time.setHours(0);
        return time;
    },
    nestDataTotals: function(category, cat_i) {
        var nest = d3.nest();
        
        // Category key
        if(cat_i < 4) {
            nest.key(function(d) { return d[cat_i]; });
        } else {
            nest.key(function(d) { 
                var time = data.timestamps[d[cat_i]];
                return data.timeInterpolate(time); 
            });
        }
        
        // Rollup
        nest.rollup(function (leaves) {
            return d3.sum(leaves, function(d) {
                return d[5]; 
            });
        });
        
        var nested_data = nest.entries(data.all);
        var out_data = {};
        
        if(cat_i < 4) { // Type/Distinct/Found In/Keyword
            return nested_data.forEach(function(nested_entry) {
                var id = legend.series_ids[category][nested_entry.key];
                var series_entry = data.series_byID[id];
                
                series_entry.sum = nested_entry.values;
            });
        } else { // Timestamps
            data.time_totals = nested_data.map(function(nested_entry) {
                return {
                    timestamp: new Date(nested_entry.key),
                    value: nested_entry.values
                };
            });
        }
    },
    nestDataSubtotals: function(category, cat_i) {
        // Prepare nesting function
        var nest = d3.nest();
        
        // Category key
        nest.key(function(d) {
            return d[cat_i];
        });
        
        // Time key
        nest.key(function (d) {
            var time = util.date(data.timestamps[d[4]]);
//            console.log(d[4], data.timestamps[d[4]], time);
            if(options.resolution.is('tenminute'))
                time.setMinutes(Math.floor(time.getMinutes() / 10) * 10);
            if(options.resolution.is('hour') || options.resolution.is("day"))
                time.setMinutes(0);
            if(options.resolution.is("day"))
                time.setHours(0);
            return time;
        });
        
        // Rollup
        nest.rollup(function (leaves) {
            return d3.sum(leaves, function(d) {
//                if(cat_i != 0 && !data.shown.y.includes(d[0]))
//                    return 0;
//                if(cat_i != 1 && !data.shown.d.includes(d[1]))
//                    return 0;
//                if(cat_i != 2 && !data.shown.f.includes(d[2]))
//                    return 0;
//                if(cat_i != 3 && !data.shown.k.includes(d[3]))
//                    return 0;
                if(!data.shown.y.includes(d[0]))
                    return 0;
                if(!data.shown.d.includes(d[1]))
                    return 0;
                if(!data.shown.f.includes(d[2]))
                    return 0;
                if(!data.shown.k.includes(d[3]))
                    return 0;
                return d[5]; 
            });
        });
        
        var nested_data = nest.entries(data.all);
        nested_data.forEach(function(nested_entry) {
            var id = legend.series_ids[category][nested_entry.key];
            var series_entry = data.series_byID[id];
            
            // Fill in values, including filling any empty space
            var series_data_indexed = {};
            nested_entry.values.forEach(function(d) {
                series_data_indexed[d.key] = d.values;
            });
            series_entry.values = data.timestamps_nested.map(function(d) {
                var value = series_data_indexed[d];
                return {
                    timestamp: d,
                    value: value || 0
                }
            });
            
            // Sum
            series_entry.total = d3.sum(series_entry.values, function(d) {
                return d.value;
            });
            
            // Max
            series_entry.max = d3.max(series_entry.values, function(d) {
                return d.value;
            });
        });
    },
    stackTimeseries: function() {
        if (options.display_type.is("wiggle")) {
            data.stack.offset("wiggle");
        } else if (options.display_type.is("stream_expand")) {
            data.stack.offset("expand");
        } else if (options.display_type.is("stream")) {
            data.stack.offset("silhouette");
        } else {
            data.stack.offset("zero");
        }

        // Set stack representation of data
        if(options.display_type.is("percent")) {
            data_100 = data.series.map(function(series) {
                var new_series = JSON.parse(JSON.stringify(series)); // Cheap cloning
                console.log(new_series);
                new_series.values = new_series.values.map(function(datum, i) {
                    var new_datum = datum;
                    new_datum.timestamp = new Date(new_datum.timestamp);
                    new_datum.value *= 100 / data.total_of_series[i];
                    return new_datum;
                });
                return new_series;            
            });
            data.stacked = data.stack(data_100);
        } else {
            data.stacked = data.stack(data.series);
        }
    },
    updateCollection: function() {
        var fields = {};
        $("#edit_form").serializeArray().forEach(function(x) { fields[x.name] = x.value; });
        
        data.callPHP('collection/update', fields, options.editWindowUpdated); // add a callback
    },
    callPHP: function(url, fields, callback, error_callback) {
        if(!fields)
            fields = {};
        if(!callback)
            callback = function() {};
        if(!error_callback)
            error_callback = function() {};
        
        $.ajax({
            url: 'scripts/php/' + url + '.php',
            type: "POST",
            data: fields,
            cache: false,
            success: callback,
            error: error_callback
        });
    },
    rmTweetCount: function(search_text, search_name) {
        var post = {
            event_id: data.collection.ID,
            keyword: search_name,
        };
        if(search_text == 'rumor') {
            post.keyword = data.rumor.ID;
        }
        
        data.callPHP('timeseries/rm', post, function() {
            data.genTweetCount(search_text, search_name);
        });
    },
    genTweetCount: function(search_text, search_name) {
        var post = {
            event_id: data.collection.ID,
            search_name: search_name,
            search_text: search_text
        };
        
        // Generate fields
        if(!post.search_name)
            post.search_name = post.search_text;
        
        post.search_text = post.search_text
            .replace(/\\W(.*)\\W/g, "[[:<:]]$1[[:>:]]");
        
        var progress_div = '#choose_add_term';
        if(search_text == 'rumor') {
            post.rumor_id = data.rumor.ID;
            post.search_name = data.rumor.ID;
            progress_div = '#edit-window-gencount-div';
        } else {
            options.add_term.reset();
            $("#input_add_term").blur();
        }
        
        // Initialize and start a stream
        var args = {
            name: 'add_term',
            url: 'timeseries/gen',
            post: post,
            failure_msg: "Problem generating new series from query",
            progress_div: progress_div,
            progress_button: true,
            on_finish: data.loadCollectionData
        };
        
        var stream = new Stream(args);
        stream.start();
    },
    getTweets: function(args) {
        var post = {
            event_id: data.collection.ID
        };
        var title = "";

        if(options.fetched_tweet_order.is("rand")) {
            post.rand = '';
//            title += 'Random ';
        }
        
        // Distinctiveness
        if(args.series && args.series.type == "Distinctiveness") {
            post.distinct = args.series.name == 'distinct' ? 1 : 0;
            title += args.series.name + ' ';
        } else if(data.shown.d.length != 2) {
            var distinct = legend.series_names['Distinctiveness'][data.shown.d[0]];
            post.distinct = distinct == 'distinct' ? 1 : 0;
            title += distinct + ' ';
        }
        
        // Tweet Types
        if(args.series && args.series.type == "Tweet Type") {
            post.type = args.series.name;
            title += args.series.name + ' ';
        } else if(data.shown.y.length != 4) {
            var types = data.shown.y.map(function(i) {
                return legend.series_names['Tweet Type'][i];
            });
            post.type = types.join("','");
            title += types.join('/') + ' ';
        }
        
        // Found In
        if(args.series && args.series.type == 'Found In') {
            disp.alert('Getting Tweets by "Found In" type is not yet supported', 'danger');
            return;
        }
        
        title += 'Tweets';

        // Keywords
        if(args.series && args.series.category == 'Keyword') {
            if(args.series.type == 'Rumor') {
                post.search_text = args.series.rumor.Query;
                title += ' with text r/' + post.search_text + '/';
            } else {
                post.search_text = args.series.name;
                title += ' with text "' + post.search_text + '"';
            }
        }
        
        if('rand' in args)
            post.rand = args.rand;
        if('rumor_id' in args)
            post.rumor_id = args.rumor_id;
        if('limit' in args)
            post.limit = args.limit;
        if('csv' in args)
            post.csv = args.csv;
        
        if(!('time_min' in args))
            args.time_min = options.time_min.min;
        if(!('time_max' in args))
            args.time_max = options.time_max.max;

        post.time_min = util.formatDate(args.time_min);
        title += " between <br />" + util.formatDate(args.time_min);
        post.time_max = util.formatDate(args.time_max);
        title += " and " + util.formatDate(args.time_max);
        
        data.callPHP('tweets/get', post, function(filedata) {
            if('csv' in post)
                data.handleTweets(filedata);
            else
                disp.tweetsModal(filedata, post, title);
        }, function() { 
            disp.alert('Unable to retreive tweets', 'danger');
        });
    },
    getRumor: function() {
        url = "scripts/php/collection/getRumor.php";
        url += "?rumor_id=" + options.rumor.get();
        url += "&event_id=" + data.collection.ID;
        url += '&time_min="' + util.formatDate(data.collection.StartTime) + '"';
        url += '&time_max="' + util.formatDate(data.collection.StopTime) + '"';
        url += '&definition="' + "hello" + '"';
        url += '&query="' + "pzbooks|[[:<:]]bot[[:>:]],know|knew|predict|before|[[:<:]]11[[:>:]]|early" + '"';
        
        if(options.rumor.get() == '_new_')
            url += "&new";
        
        d3.json(url, function(error, filedata) {
            if (error) throw error;

            data.rumor = filedata[0];
            delete data.rumor['StartTime'];
            delete data.rumor['StopTime']; 
        });
    },
    getRumorCount: function() {
        var post = {
            event_id: data.collection.ID,
            rumor_id: data.rumor.ID,
            time_min: util.formatDate(options.time_min.min),
            time_max: util.formatDate(options.time_max.max),
            total: ''
        };
        
        data.callPHP('collection/countTweetIn', post, function(file_data) {
            var count = JSON.parse(file_data);
            document.getElementById("edit-window-tweetin-count")
                .value = count[0]['count'];
        }, function() { 
            disp.alert('Unable to retreive count of tweets in rumor', 'danger', '#selectedTweetsModal');
        });
    },
    genTweetInCollection: function(type) {
        // Set fields
        var args = {
            name: 'genTweetInCollection',
            url: 'collection/genTweetIn',
            post: {
                event_id: data.collection.ID,
                rumor_id: data.rumor.ID,
                search_text: data.rumor.Query
            },
            failure_msg: "Problem finding tweets that were in the rumor",
            progress_div: '#edit-window-tweetin-div',
            progress_button: true,
            on_finish: data.startLoadingCollection
        };
        
        if(type == 'rumor') {
            args.on_finish = function() {
                data.getRumorCount();
            }
        }
        
        // Delete the TweetInCollection
        data.callPHP('collection/rmTweetIn', args.post, function() {
            // Initialize and start Stream
            var stream = new Stream(args);
            stream.start();
        }, function() {
            disp.alert('Problem deleting the last TweetInCollection records');
        })
        
    },
    handleTweets: function(tweets_str) {
        tweets_str = 'Tweet_' + tweets_str;
        var tweets = d3.csv.parse(tweets_str);
        
        var tweet_text_unique = new Set();
        var tweets_unique = [];
        
        // Strip out newlines
        tweets.forEach(function(tweet) {
            tweet.Text = tweet.Text.replace(/(?:\r\n|\r|\n)/g, ' ');
            var text_no_url = tweet.Text.replace(/(?:http\S+)/g, ' ');
            
            if(tweet_text_unique.has(text_no_url)) {
                tweet.Distinct = 0;
            } else {
                tweet_text_unique.add(text_no_url);
                if(tweets_unique.length < 100) {
                    tweets_unique.push(tweet);
                }
            }
        });
        
        // Turn it back into a CSV and download
        tweets_str = d3.csv.format(tweets_unique);
        data.download(tweets_str);
    },
    download: function(content, fileName, mimeType) {
        var a = document.createElement('a');
        fileName = fileName || 'data.csv';
        mimeType = mimeType || 'text/csv'; // 'application/octet-stream';

        if (navigator.msSaveBlob) { // IE10
            return navigator.msSaveBlob(new Blob([content], { type: mimeType }),     fileName);
        } else if ('download' in a) { //html5 A[download]
            a.href = 'data:' + mimeType + ',' + encodeURIComponent(content);
            a.setAttribute('download', fileName);
            document.body.appendChild(a);
            setTimeout(function() {
                a.click();
                document.body.removeChild(a);
            }, 66);
            return true;
        } else { //do iframe dataURL download (old ch+FF):
            var f = document.createElement('iframe');
            document.body.appendChild(f);
            f.src = 'data:' + mimeType + ',' + encodeURIComponent(content);

            setTimeout(function() {
                document.body.removeChild(f);
            }, 333);
            return true;
        }
    }
}
