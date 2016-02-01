/*global data, disp, legend, util, options, d3, console */

function Stream(args) {
    var self = this;

    // Defaults
    self.name = 'r' + Math.floor(Math.random() * 1000000 + 1);
    self.url = "";
    self.post = {};
    self.time_res = 1; // 1 Hour
    self.progress = {};
    self.progress_div = '#timeseries_div';
    self.progress_text = "Working";
    self.progress_button = false;
    self.chunk_index = 0;
    self.time_min = options.time_min.min;
    self.time_max = options.time_max.max;
    self.failure_msg = 'Problem with data stream';
    self.on_chunk_finish = function () {};
    self.on_finish = function () {};
    
    // Save args  
    Object.keys(args).forEach(function (item) {
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
        this.progress = new Progress({
            name:      this.name,
            parent_id: this.progress_div,
            full:      this.progress_button,
            text:      this.progress_text,
            steps:     this.time_chunks.length - 1
        });
        this.progress.start();

        this.chunk();
    },
    chunk: function () {
        // If we are at the max, end
        if (this.chunk_index >= this.time_chunks.length - 1) {
            // Load the new data
            this.on_finish();

            // End the progress bar and stop function
            this.progress.end();
            return;
        } else if(this.chunk_index < 0) {
            // End prematurely
            this.progress.end();
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
        this.progress.update(this.chunk_index + 1, this.progress_text);

        this.on_chunk_finish(file_data);

        // Start loading the next batch
        this.chunk_index = this.chunk_index + 1;
        this.chunk();
    },
    chunk_failure: function (a, b, c) {
        console.log(a, b, c);
        disp.alert(this.failure_msg);
        this.progress.end();
    },
    stop: function() {
        this.chunk_index = -100;
    }
};

function Data() {
    var self = this;
    
    // Time
    self.time = {
        name: "Time",
        collection_min: new Date(),
        collection_max: new Date(),
        min: new Date(),
        max: new Date(),
        stamps: [],
        stamps_nested: [],
        stamps_nested_int: [],
        nested_min: new Date(),
        nested_max: new Date(),
        data_index: 4
    };
    
    // Collection info
    self.collection = {};
    self.collections = {};
    self.collection_names = [];
    
    // Data
    self.file = [];
    self.all = {};
    self.stacked = {};
    self.total_of_series = [];
    self.total_tweets = [];
    
    // Timeseries
    self.series = {};
    self.series_arr = [];
    
    // Categories
    self.cats_arr = [
        {
            name: 'Tweet Type', id: 'lTweet_Type',
            short: 'y', data_index: 0,
            series_names: ['original', 'retweet', 'reply', 'quote'],
            series_ids: ['tt_original', 'tt_retweet', 'tt_reply', 'tt_quote'],
            series: {}, series_arr: [], series_plotted: [],
            filter: false
        },{
            name: 'Distinctiveness', id: 'lDistinctiveness',
            short: 'd', data_index: 1,
            series_names: ['distinct', 'repeat'],
            series_ids: ['di_distinct', 'di_repeat'],
            series: {}, series_arr: [], series_plotted: [],
            filter: false
        },{
            name: 'Found In', id: 'lFound_In',
            short: 'f', data_index: 2,
            series_names: ['Any', 'Text', 'Quote', 'URL'],
            series_ids: ['fi_Any', 'fi_Text', 'fi_Quote', 'fi_URL'],
            series: {}, series_arr: [], series_plotted: [],
            filter: false
        },{
            name: 'Keyword', id: 'lKeyword',
            short: 'k', data_index: 3,
            series_names: ['_total_'],
            series_ids: ['l_total'],
            series: {}, series_arr: [], series_plotted: [],
            filter: false
        }
    ];
    self.cats = self.cats_arr.reduce(function(all, category) {
        all[category.name] = category;
        return all;
    }, {});
    
    // Functions
    self.stack = d3.layout.stack()
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
        data.collections.forEach(function (collection) {
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
            progress_text: 'Loading Data',
            on_finish: function() {
                pipeline.start();
            },
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
    parseLoadedCollectionData: function() {
        // Format selections
        d3.select('#choose_collection button')
            .attr('disabled', null);
        
        // Get the timestamps
        data.time.stamps = util.lunique(data.file.map(function(d) { return d.Time; }));

        if(data.time.stamps.length == 0)
            data.time.stamps = [util.formatDate(new Date())];
        var keywords = Array.from(new Set(data.file.map(function(d) {return d.Keyword})));
        data.cats['Keyword'].series_names = keywords
        data.cats['Keyword'].series_ids = keywords.map(function(d) {
            return util.simplify(d) });

        // Fill in missing timestamps
        data.time.min = util.date(data.time.stamps[0]);
        data.time.max = util.date(data.time.stamps[data.time.stamps.length - 1]);
        if(options.time_limit.get().slice(0, 1) == '-')
            last_timestamp = util.formatDate(new Date());

        var new_timestamps = [];
        for(var timestamp = new Date(data.time.min);
            timestamp <= data.time.max;
            timestamp.setMinutes(timestamp.getMinutes() + 1)) {
            new_timestamps.push(util.formatDate(timestamp));
        }
        data.time.stamps = new_timestamps;
        
        var types = data.cats['Tweet Type'].series_names;
        var foundins = data.cats['Found In'].series_names;
        
        // Prepopulate with zeros
        data.all = types.map(function(type, i_y) {
            return [0, 1].map(function(distinct, i_d) {
                return foundins.map(function(foundin, i_f) {
                    return keywords.map(function(keyword, i_k) {
                        return data.time.stamps.map(function(time, i_t) {
                            return 0;
                        });
                    });
                });
            });
        });        
        // Write data
        for(row in data.file) {
            var i_d = data.file[row]['Distinct'] == 1 ? 0 : 1;
            var i_f = foundins.indexOf(data.file[row]['Found_In']);
            var i_k = keywords.indexOf(data.file[row]['Keyword']);
            var i_t = data.time.stamps.indexOf(data.file[row]['Time']);
            
            if(typeof data.file[row] !== 'object')
                continue;

            types.forEach(function(tweet_type) {
                var i_y = types.indexOf(tweet_type);
                data.all[i_y][i_d][i_f][i_k][i_t] = 
                    parseInt(data.file[row][tweet_type]);
            });
        }

        // Clear the data file object (since it takes up a lot of space)
        data.file = [];
    },
    initializeSeries: function() {
        // Clear lists of series
        data.series = {};
        data.series_arr = [];
        data.cats_arr.forEach(function(category) {
            category.series = {};
            category.series_arr = [];
            category.series_plotted = [];
        });
        
        // Generate series
        data.cats_arr.forEach(function(category, j) {
            if(category.name == 'Keyword') {
                category.series_arr = category.series_names
                    .map(data.generateKeywordSeries)
            } else {
                category.series_arr = category.series_names
                    .map(function(name, i) {
                    var entry = {
                        display_name: name,
                        name: name,
                        id: category.series_ids[i],
                        order: (i + 1) * 100 + j * 10000,
                        isAggregate: name == 'Any',
                        shown: name != 'Any',
                        type: category.name,
                        category: category.name
                    };

                    return entry;
                });
            }
            
            // Fill in other indices
            category.series_arr.forEach(function(series) {
                data.series[series.id] = series;
                data.series_arr.push(series);
                
                category.series[series.id] = series;
                if(!series.isAggregate)
                    category.series_plotted.push(series);
            });
        });

        // Populate Legend
        data.cats_arr.forEach(legend.populate);

        // Make sure we have data before going forward
        if(!data.all) {
            disp.alert('No data loaded', 'danger');
            pipeline.abort();
            return;
        }
    },
    generateKeywordSeries: function(name, i) {
        var entry = {
            display_name: name,
            name: name,
            id: util.simplify(name),
            order: (i + 1) * 100 + 30000, // since it is the last main series type
            isAggregate: name == '_total_'
        };

        // Determine if it is shown
        if(options.chart_category.is('Keyword')) {
            entry.shown = entry.name != '_total_';
        } else {
            entry.shown = entry.name == '_total_';
        }

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
        
        return entry
    },
    recalculateShown: function() {        
        data.shown = data.cats_arr.map(function(category) {
            return category.series_arr.reduce(function(list, series, i) {
                if(series.shown)
                    list.push(i); 
                return list;
            }, []);
        });
    },
    getCategorySubtotals: function() {
        // Get nested timestamps
        var time_stamps_nested = d3.nest()
            .key(data.timeInterpolate)
            .entries(data.time.stamps);
        
        // Aux time index array (so we don't have to nest again)
        data.time.t2tn = [];
        time_stamps_nested.forEach(function(nest, i_tn) {
            nest.values.forEach(function(val, i_t) {
                data.time.t2tn.push(i_tn);
            });
        });
        
        // Simplify
        data.time.stamps_nested = time_stamps_nested.map(function(d) {
            return new Date(d.key);
        });
        
        // Make other time nest indices
        data.time.stamps_nested_int =
            data.time.stamps_nested.map(function(d) {
            return d.getTime();
        });
        data.time.nested_min = data.time.stamps_nested[0];
        data.time.nested_max = data.time.stamps_nested[data.time.stamps_nested.length - 1];
        
        // Get nested data
        data.cats_arr.forEach(data.nestDataSubtotals);
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
    nestDataTotals: function(category) {
        var nest = d3.nest();
        
        // Category key
        if(category.name == "Time") {
            nest.key(function(d) { 
                var time = data.time.stamps[d[category.data_index]];
                return data.timeInterpolate(time); 
            });
        } else {
            nest.key(function(d) { return d[category.data_index]; });
        }
        
        // Rollup
        nest.rollup(function (leaves) {
            return d3.sum(leaves, function(d) {
                return d[5]; 
            });
        });
        
        var nested_data = nest.entries(data.all);
        var out_data = {};
        
        if(category.name == "Time") { // Timestamps
            data.time_totals = nested_data.map(function(nested_entry) {
                return {
                    timestamp: new Date(nested_entry.key),
                    value: nested_entry.values
                };
            });
        } else { // Type/Distinct/Found In/Keyword
            return nested_data.forEach(function(nested_entry) {
                // Check this
                category.series_arr[nested_entry.key].sum = nested_entry.values;
//                var id = category.series_ids[nested_entry.key];
//                var series_entry = data.series_byID[id];
//                
//                series_entry.sum = nested_entry.values;
            });
        }
    },
    nestDataSubtotals: function(category) {
        data.time_totals = data.time.stamps_nested.map(function(time, i_tn) {
            return {
                timestamp: new Date(time), 
                value: 0
            };
        });
        var subtotals = data.cats_arr.map(function(category) {
            return category.series_arr.map(function(series, i_s) {
                return data.time.stamps_nested.map(function(time, i_tn) {
                    return 0;
                });
            });
        });
        
        // Iterate through data adding it up
        data.shown[0].forEach(function(i_y) {
            data.shown[1].forEach(function(i_d) {
                data.shown[2].forEach(function(i_f) {
                    data.shown[3].forEach(function(i_k) {
                        data.time.stamps.map(function(timestamp, i_t) {
                            var value = data.all[i_y][i_d][i_f][i_k][i_t];
                            var i_tn = data.time.t2tn[i_t];
                            
                            data.time_totals[i_tn].value += value;
                            subtotals[0][i_y][i_tn] += value;
                            subtotals[1][i_d][i_tn] += value;
                            subtotals[2][i_f][i_tn] += value;
                            subtotals[3][i_k][i_tn] += value;
                        })
                    });
                });
            });
        });
        
        // Fill in the data in the structures
        subtotals.forEach(function(cat_data, i_c) {
            var category = data.cats_arr[i_c];
            cat_data.forEach(function(series_data, i_s) {
                var series = category.series_arr[i_s];
                
                series.values = series_data.map(function(d, i_tn) {
                   return {
                       timestamp: data.time.stamps_nested[i_tn],
                       value: d
                   } 
                });

                // Sum
                series.sum = d3.sum(series_data);
                series.total = d3.sum(series_data);

                // Max
                series.max = d3.max(series_data);
            });
        });
    },
    orderSeries: function() {
        data.cats['Keyword'].series_plotted.sort(legend.cmp);
        legend.container_keywords.selectAll('div.legend_entry')
            .sort(legend.cmp_byID);
    },
    makeChartTimeseries: function() {        
        // Configure stream types
        if (options.display_type.is("wiggle")) {
            data.stack.offset("wiggle");
        } else if (options.display_type.is("stream_expand")) {
            data.stack.offset("expand");
        } else if (options.display_type.is("stream")) {
            data.stack.offset("silhouette");
        } else {
            data.stack.offset("zero");
        }

        // Find out what we are plotting
        var category = options.chart_category.get();
        var data_to_plot = data.cats[category].series_plotted;
        
        // Set legend filter buttons
        legend.configureFilters();
        
        // Set stack representation of data
        if(options.display_type.is("percent")) {
            data_100 = data_to_plot.map(function(series) {
                var new_series = JSON.parse(JSON.stringify(series)); // Cheap cloning
                new_series.values = new_series.values.map(function(datum, i) {
                    var new_datum = datum;
                    new_datum.timestamp = new Date(new_datum.timestamp);
                    new_datum.value *= 100 / data.time_totals[i];
                    return new_datum;
                });
                return new_series;            
            });
            data.stacked = data.stack(data_100);
        } else {
            data.stacked = data.stack(data_to_plot);
        }
        
        // Change data for display
        var n_series = data.stacked.length;
        if(data.stacked.length == 0) {
            disp.alert('Failure to display data');
            
            d3.selectAll('.series').remove();
            return;
        }

        // Convert to separate area plot if that's asked for
        n_datapoints = data.stacked[0].values.length;
        if(options.display_type.is("separate")) {
            for (var i = n_series - 1; i >= 0; i--) {
                data.stacked[i].offset = 0;
                if(i < n_series - 1) {
                    data.stacked[i].offset = data.stacked[i + 1].offset;
                    data.stacked[i].offset += data.stacked[i + 1].max;
                }

                data.stacked[i].values.forEach(function(datum) {
                    datum.value0 = data.stacked[i].offset;
                });
            }
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
            progress_text: "Working",
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
        var category = data.cats['Distinctiveness'];
        var shown = data.shown[category.data_index];
        if(args.series && args.series.type == "Distinctiveness") {
            post.distinct = args.series.name == 'distinct' ? 1 : 0;
            title += args.series.name + ' ';
        } else if(shown.length != 2) {
            var distinct = category.series_names[shown[0]];
            post.distinct = distinct == 'distinct' ? 1 : 0;
            title += distinct + ' ';
        }
        
        // Tweet Types
        category = data.cats['Tweet Type'];
        shown = data.shown[category.data_index];
        if(args.series && args.series.type == "Tweet Type") {
            post.type = args.series.name;
            title += args.series.name + ' ';
        } else if(shown.length != 4) {
            var types = shown.map(function(i) {
                return category.series_names[i];
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
            progress_text: "Working",
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
