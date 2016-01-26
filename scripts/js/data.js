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

        this.on_chunk_finish();

        // Start loading the next batch
        this.chunk_index = this.chunk_index + 1;
        this.chunk();
    },
    chunk_failure: function (a, b, c) {
        console.log(a, b, c);
        disp.alert(this.failure_msg);
        disp.endProgressBar(this.name);
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
    self.stacked = {}; // formerly data_stacked
    self.series = {}; // formerly series_data
    self.series_byID = {};
    self.all = {}; // formerly data_raw
    self.total_of_series = []; // formerly total_byTime
    self.total_tweets = []; // formerly context_byTime
    
    // Series
    self.keywords = {};
    self.tweet_types = ['original', 'retweet', 'reply', 'quote'];
    self.distinct_types = ['distinct', 'repeat'];
    self.series_names = [];
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

        // Clear the raw data object
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
        
        // Send a signal to start loading the collection
        data.startLoadingCollection();
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
    startLoadingCollection: function() {
        // Determine the base URL
        var url = "scripts/php/timeseries/get.php";
        url += "?event_id=" + data.collection.ID;
        
        // Generate a list of times every 3 hours
        var time_chunks = [];
        for(var timestamp = new Date(data.time.min);
            timestamp < data.time.max;
            timestamp.setMinutes(timestamp.getMinutes() + 60 * 3)) {
            time_chunks.push(util.formatDate(timestamp));
        }
        time_chunks.push(util.formatDate(data.time.max));
        
        // Disable the collection button
        d3.select('#choose_collection button')
            .attr('disabled', true);
        
        // Start progress bar
        disp.startProgressBar('load_collection');
        
        // Make base file container
        data.file = [];
        
        // Send off the first chunk of time to generate tweet counts
        data.loadDataFile(url, time_chunks, 0);
    },
    loadDataFile: function(url_base, time_chunks, index) {
        // If we are at the max, end
        if(index >= time_chunks.length - 1) {
            // Set the text to rendering
            d3.select('#load_collection_progress')
                .text('Rendering Chart');
            
            // Load the new data
            setTimeout(function() {
            data.parseCSVData();
            
            // End the progress bar and stop function
            disp.endProgressBar('load_collection');
            d3.select('#choose_collection button')
                .attr('disabled', null);
            }, 1000);
                
            return;
        }
    
        var url = url_base;
        url += '&time_min="' + time_chunks[index] + '"';
        url += '&time_max="' + time_chunks[index + 1] + '"';
//        console.info(url);
    
        d3.csv(url, function(error, file_data) {
            if(error || !file_data) {
                console.debug(error);
                console.debug(file_data);
                
                // Abort
                disp.alert("Problem loading data file");
                disp.endProgressBar('load_collection');
                d3.select('#choose_collection button')
                    .attr('disabled', null);
                return;
            }
            
            // Update the progress bar
            disp.updateProgressBar('load_collection',
                                   Math.floor((index + 1) / (time_chunks.length - 1) * 100));
            
            // Append the data to the data loaded so far
            data.file = data.file.concat(file_data);

            // Start loading the next batch
            data.loadDataFile(url_base, time_chunks, index + 1);
        });
    },
    parseCSVData: function() {
        // Get the timestamps
        data.timestamps = util.lunique(data.file.map(function(d) { return d.Time; }));

        if(data.timestamps.length == 0)
            data.timestamps = [util.formatDate(new Date())];
        data.keywords = Array.from(new Set(data.file.map(function(d) {return d.Keyword})));
        data.keywords = data.keywords.reduce(function(arr, word) {
            if(word != '_total_')
                arr.push(word);
            return arr;
        }, [])

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

        var data_raw0 = {};
        // Create matrix to hold values
        options.found_in.ids.map(function(found_in) {
            data_raw0[found_in] = {}
            options.subset.ids.map(function(subset) {
                data_raw0[found_in][subset] = {};
                data.timestamps.map(function (timestamp) {
                    var entry = {
                        timestamp: util.date(timestamp),
                        "_total_": 0
                    };
                    data.keywords.map(function(keyword) {
                        entry[keyword] = 0;
                    });

                    data_raw0[found_in][subset][timestamp] = entry;
                });
            });
        });

        // Input values from the loaded file
        for(row in data.file) {
            var timestamp = data.file[row]['Time'];
            var found_in = data.file[row]['Found_In'];
            var keyword = data.file[row]['Keyword'];

            if(typeof data.file[row] !== 'object')
                continue;

            options.subset.ids.map(function(subset) {
                data_raw0[found_in][subset][timestamp][keyword] =
                    parseInt(data.file[row][subset]);
            });
        }

        options.found_in.ids.map(function(found_in) {
            data.all[found_in] = {}

            options.subset.ids.map(function(subset) {
                data.all[found_in][subset] = [];
                for(row in data_raw0[found_in][subset]) {
                    data.all[found_in][subset].push(data_raw0[found_in][subset][row]);
                }
            });
        });

        // Clear the data file object (since it takes up a lot of space)
        data.file = {};
        
        // Set Time Domain and Axis
        disp.focus.x.domain(  [data.time.min, data.time.max]).clamp(true);
        disp.context.x.domain([data.time.min, data.time.max]);

        // Clear brush
        disp.brush.clear();
        disp.plot_area.svg.selectAll('.brush').call(disp.brush);

        data.initializeSeries();
    },
    initializeSeries: function() {
        data.series = data.keywords
            .map(function(name, i) {
            var entry = {
                display_name: name,
                name: name,
                id: util.simplify(name),
                order: (i + 1) * 100,
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
                return prev |= keyword.toLowerCase() == entry.name.toLowerCase();
            }, false);
            entry.isOldKeyword = data.collection
                .OldKeywords.reduce(function(prev, keyword) {
                return prev |= keyword.toLowerCase() == entry.name.toLowerCase();
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
            
            return entry;
        });
        
        // Types of tweets
        data.tweet_types
            .forEach(function(name, i) {
            var entry = {
                display_name: name,
                name: name,
                id: util.simplify(name),
                order: (i + 1) * 100,
                shown: true,
                type: legend.section_names[1] // Tweet Type
            };
            
            data.series.push(entry);
        });
        
        // Distinct/Repeat Tweets
        data.distinct_types
            .forEach(function(name, i) {
            var entry = {
                display_name: name,
                name: name,
                id: util.simplify(name),
                order: (i + 1) * 100,
                shown: true,
                type: legend.section_names[2] // Distinctiveness
            };
            
            data.series.push(entry);
        });
        
        // Make alternative indices
        data.series_names = data.series.map(function(series) {
            data.series_byID[series.id] = series;
            return series.name;
        });
        
        // Start data series
        data.loadNewSeriesData();

        // Populate Legend    
        legend.section_names.forEach(legend.populate);

        // Finish preparing the data for loading
        data.prepareData();  
    },
    changeSeries: function(subset) {
        // Load the main series
        data.loadNewSeriesData();

        // Populate Legend    
        legend.populate();

        // Finish preparing the data for loading
        data.prepareData();   
    },
    changeData: function() {
        this.loadNewSeriesData();

        this.prepareData();
    },
    loadNewSeriesData: function() {
        var found_in = options.found_in.get();
        var subset = options.subset.get();

        
        data.series.map(function(datum) {
            if(datum.type == 'Tweet Type') {
                datum.sum = data.all[found_in][datum.name]
                    .reduce(function(cur_sum, datapoint) {
                    return cur_sum + datapoint['_total_'];
                }, 0);
                datum.total = datum.sum;
            } else if(datum.type == 'Distinctiveness') {
                if(datum.name == 'Distinct') {
                    datum.sum = data.all[found_in]['distinct']
                        .reduce(function(cur_sum, datapoint) {
                        return cur_sum + datapoint['_total_'];
                    }, 0);
                } else {
                    datum.sum = data.all[found_in]['all']
                        .reduce(function(cur_sum, datapoint) {
                        return cur_sum + datapoint['_total_'];
                    }, 0);
                    datum.sum -= data.series_byID['ldistinct'].sum;
                }
                datum.total = datum.sum;
            } else {
                datum.sum = data.all[found_in]['all']
                    .reduce(function(cur_sum, datapoint) {
                    return cur_sum + datapoint[datum.name];
                }, 0);
                datum.total = data.all[found_in][subset]
                    .reduce(function(cur_sum, datapoint) {
                    return cur_sum + datapoint[datum.name];
                }, 0);
            }
        });
    },
    prepareData: function() {
        var found_in = options.found_in.get();
        
        // If we haven't loaded the data yet, tell the user and ask them to wait
        if(!('Text' in data.all) || data.all[found_in][options.subset.get()] == undefined) {
            return;
        }
        
        var data_nested = data.nestData();
        if(!data_nested) {
            disp.alert('Problem adding up time series', 'danger')
            return;
        }

        data.timestamps_nested = data_nested.map(function(item) { return item.key; });

        // Convert data to a format the charts can use
        var data_ready = [];
        data_nested.map(function (d, i) {
            new_data = d.values;
            new_data.timestamp = new Date(d.key);
            data_ready.push(new_data);
        });

        // Add a duplicate entry if there is only one data point
        if(data_ready.length == 1) {
            var dup = $.extend({}, data_ready[0]); // cheap cloning
            dup.timestamp = new Date(dup.timestamp.getTime() + 60000);
            data_ready.push(dup);
        }

        data.total_of_series = data_ready.map(function(datum) {
            return Math.max(data.series_names.reduce(function(running_sum, word) {
                return running_sum += datum[word];
            }, 0), 1);
        });
        data.total_tweets = data_ready.map(function(datum) {
            return {timestamp: datum.timestamp, value: datum['_total_']};
        });

        // Reorder by total size
        data.series.sort(legend.cmp);
        legend.container_series.selectAll('div.legend_entry').sort(legend.cmp_byID);
        disp.setColors();

        // Add the nested data to the series
        data.series.map(function(datum) {

            datum.values = data_ready.map(function(d) {
                return {timestamp: d.timestamp, value: d[datum.name]};
            });
            datum.max = data_ready.reduce(function(cur_max, d) {
                return Math.max(cur_max, d[datum.name]);
            }, 0);
        });

        // Set Time Domain and Axis appropriate to the resolution
        disp.setContextTime(data_ready[0].timestamp, data_ready[data_ready.length - 1].timestamp);

        disp.setFocusAxisLabels();

        // Display values on the context chart
        disp.context.y.domain([0, data_ready.reduce(function (cur_max, series) {
                return Math.max(cur_max, series["_total_"]);
            }, 0)])
                .range([disp.context.height, 0]);

        disp.context.area
            .interpolate(options.shape.get());

        disp.context.svg.selectAll(".x, .area").remove();
        disp.context.svg.append("path")
            .datum(data_ready)
            .attr("class", "area")
            .attr("d", disp.context.area);

        disp.context.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + disp.context.height + ")")
            .call(disp.context.xAxis);

        disp.context.svg.append("g")
            .attr("class", "x brush")
            .call(disp.brush)
            .selectAll("rect")
            .attr("y", -6)
            .attr("height", disp.context.height + 7);

        // Display the data
        disp.display();
    },
    get: function(found_in, tweet_type, keyword) {
        return 'a';
    },
    nestData: function() {
        
        return;
        // Get the patterns that we want
        var found_in = options.found_in.get();
        
        var addToShownList = function(list, name) {
            if(data.series_byID[util.simplify(name)].shown) {
                list.push(name);
            }
            return list;
        }
        
        var shown = {
            keywords: data.keywords.reduce(addToShownList, []),
            tweet_types: data.tweet_types.reduce(addToShownList, []),
            distinct_types: data.distinct_types.reduce(addToShownList, [])
        }
        
        if(shown.keywords.length == data.keywords.length)
            shown.keywords = ['_total_'];
        if(shown.tweet_types.length == data.tweet_types.length)
            shown.tweet_types = ['all'];
//        if(shown.distinct_types.length == data.distinct_types.length)
//            shown.distinct_types = ['_total_'];
        
        
//        console.log(legend.shown());
        
        return;
        // Aggregate on time depending on the resolution
        
        var data_nested_entries = data.all[found_in][options.subset.get()];

        for(var i = 0; i < data.all[found_in]['all'].length; i++) {
                data_nested_entries[i].original = 
                    data.all[found_in]['original'][i]['_total_'];
                data_nested_entries[i].retweet = 
                    data.all[found_in]['retweet'][i]['_total_'];
                data_nested_entries[i].reply = 
                    data.all[found_in]['reply'][i]['_total_'];
                data_nested_entries[i].quote = 
                    data.all[found_in]['quote'][i]['_total_'];

                data_nested_entries[i].distinct = 
                    data.all[found_in]['distinct'][i]['_total_'];
                data_nested_entries[i].repeat =  
                    data.all[found_in]['all'][i]['_total_'] -
                    data.all[found_in]['distinct'][i]['_total_'];
            
            data_nested_entries.push(entry);
        }

//        // Perform the nest
//        var data_nested = d3.nest()
//            .key(function (d) {
//                var time = new Date(d.timestamp);
//                if(options.resolution.is('tenminute'))
//                    time.setMinutes(Math.floor(time.getMinutes() / 10) * 10);
//                if(options.resolution.is('hour') || options.resolution.is("day"))
//                    time.setMinutes(0);
//                if(options.resolution.is("day"))
//                    time.setHours(0);
//                return time;
//            })
//            .rollup(function (leaves) {
//                var newdata = {timestamp: leaves[0].timestamp};
//                newdata['_total_'] = leaves.reduce(function(sum, cur) {
//                    return sum + cur['_total_'];
//                }, 0);
//
//                if(options.series.is('none')) {
//                    newdata['all'] = leaves.reduce(function(sum, leaf) {
//                        return sum + leaf['_total_'];
//                    }, 0);
//                } else {
//                    data.series.map(function(series) {
//                        if(series.shown) {
//                            newdata[series.name] = leaves.reduce(function(sum, leaf) {
//                                return sum + leaf[series.name];
//                            }, 0);
//                        } else {
//                            newdata[series.name] = 0;
//                        }
//                    });
//                }
//
//                return newdata;
//            })
//            .entries(data_nested_entries);
//        
//        return data_nested;
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
            on_finish: data.startLoadingCollection
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
        
        if(options.subset.is("distinct")) {
            post.distinct = 1;
            title += 'Distinct ';
        } else if(!options.subset.is('all')) {
            post.type = options.subset.get();
            title += options.subset.getLabel() + ' ';
        }
        title += 'Tweets';

        if('series' in args) {
            if(options.series.is("terms")) {
                if(args.series.isRumor) {
                    post.search_text = args.series.rumor.Query;
                    title += ' with text "' + post.search_text + '"';
                } else {
                    post.search_text = args.series.name;
                    title += ' with text "' + args.series.name + '"';
                }
            } else if(options.series.is("types")) {
                post.type = args.series.name;
                title += ' of type ' + args.series.name;
            } else if(options.series.is("distinct")) {
                post.distinct = args.series.name == "distinct" ? 1 : 0;
                title += ' that are ' + (args.series.name == "distinct" ? 'distinct' : 'not distinct')
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
        
        data.callPHP('tweets/fetch', post, function(filedata) {
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
