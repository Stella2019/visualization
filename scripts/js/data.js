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

        this.on_chunk_finish(file_data);

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
    self.file = [];
    self.stacked = {}; // formerly data_stacked
    self.series = {}; // formerly series_data
    self.series_byID = {};
    self.all = {}; // formerly data_raw
    self.total_of_series = []; // formerly total_byTime
    self.total_tweets = []; // formerly context_byTime
    
    // Series
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
        
        var stream = new Stream(args);
        stream.start();
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
        // Get the timestamps
        data.timestamps = util.lunique(data.file.map(function(d) { return d.Time; }));

        if(data.timestamps.length == 0)
            data.timestamps = [util.formatDate(new Date())];
        var keywords = Array.from(new Set(data.file.map(function(d) {return d.Keyword})));
        legend.series_names.Keyword = keywords;
        legend.series_names_nt.Keyword = keywords.filter(
            function(name){ return name != '_total_'; });

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

//        // Create matrix to hold values // Is this awful or awesome?
//        data.all = legend.series_names['Found In']
//          .reduce(function(level0, found_in) {
//            level0[found_in] = legend.series_names['Distinctiveness']
//              .reduce(function(level1, distinct) {
//                level1[distinct] = legend.series_names['Tweet Type']
//                  .reduce(function(level2, tweet_type) {
//                    level2[tweet_type] = keywords
//                      .reduce(function (level3, keyword) {
//                        level3[keyword] = data.timestamps
//                          .reduce(function (level4, timestamp) {
//                            level4[timestamp] = 0;
//                            return level4;
//                        }, {});
//                        return level3;
//                    }, {});
//                    return level2;
//                }, {});
//                return level1;
//            }, {});
//            return level0;
//        }, {});
//
//        // Input values from the loaded file
//        for(row in data.file) {
//            var timestamp = data.file[row]['Time'];
//            var found_in = data.file[row]['Found_In'];
//            var keyword = data.file[row]['Keyword'];
//            var distinct = legend.series_names['Distinctiveness']               [data.file[row]['Distinct'] ?  0 : 1];
//            
//            if(typeof data.file[row] !== 'object')
//                continue;
//
//            legend.series_names['Tweet Type'].forEach(function(tweet_type) {
//                data.all[found_in][distinct][tweet_type][keyword][timestamp] =
//                    parseInt(data.file[row][tweet_type]);
//            });
//        }
        
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

            legend.series_names['Tweet Type'].forEach(function(tweet_type) {
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
            entry.category = 'Keyword';
            
            return entry;
        });
        
        // Rest of the series (Tweet Type, Found In, Distinct)
        legend.series_cats.forEach(function(category, j) {
            if(category == 'Keyword')
                return; // Already done
            
            var series_names = legend.series_names[category];
            series_names.forEach(function(name, i) {
                var entry = {
                    display_name: name,
                    name: name,
                    id: util.simplify(name),
                    order: (i + 1) * 100 + j * 10000,
                    shown: true,
                    type: category,
                    category: category
                };

                data.series.push(entry);
            });
        });
        
        // Make alternative indices
        data.series_names = data.series.map(function(series) {
            data.series_byID[series.id] = series;
            return series.name;
        });
        
        // Start data series
        data.loadNewSeriesData();

        // Populate Legend    
        legend.series_cats.forEach(legend.populate);

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

        
//        data.series.map(function(datum) {
//            if(datum.type == 'Tweet Type') {
//                datum.sum = data.all[found_in][1][datum.name]
//                    .reduce(function(cur_sum, datapoint) {
//                    return cur_sum + datapoint['_total_'];
//                }, 0);
//                datum.total = datum.sum;
//            } else if(datum.type == 'Distinctiveness') {
//                if(datum.name == 'Distinct') {
//                    datum.sum = data.all[found_in][1]['distinct']
//                        .reduce(function(cur_sum, datapoint) {
//                        return cur_sum + datapoint['_total_'];
//                    }, 0);
//                } else {
//                    datum.sum = data.all[found_in][1]['all']
//                        .reduce(function(cur_sum, datapoint) {
//                        return cur_sum + datapoint['_total_'];
//                    }, 0);
//                    datum.sum -= data.series_byID['ldistinct'].sum;
//                }
//                datum.total = datum.sum;
//            } else {
//                datum.sum = data.all[found_in][1]['all']
//                    .reduce(function(cur_sum, datapoint) {
//                    return cur_sum + datapoint[datum.name];
//                }, 0);
//                datum.total = data.all[found_in][1][subset]
//                    .reduce(function(cur_sum, datapoint) {
//                    return cur_sum + datapoint[datum.name];
//                }, 0);
//            }
//        });
    },
    prepareData: function() {
        var found_in = options.found_in.get();
        
        // If we haven't loaded the data yet, tell the user and ask them to wait
        if(!data.all) {
            disp.alert('No data loaded', 'danger');
            return;
        }
        legend.series_cats.forEach(data.nestDataTotals);
        data.nestDataTotals('timestamps', 4);
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
        legend.container_series.selectAll('div.legend_entry').sort(legend.cmp_byID);
        disp.setColors();

        // Add the nested data to the series
//        data.series.map(function(datum) {
//
//            datum.values = data_ready.map(function(d) {
//                return {timestamp: d.timestamp, value: d[datum.name]};
//            });
//            datum.max = data_ready.reduce(function(cur_max, d) {
//                return Math.max(cur_max, d[datum.name]);
//            }, 0);
//        });

        // Set Time Domain and Axis appropriate to the resolution
        disp.setContextTime(data.timestamps_nested[0], data.timestamps_nested[data.timestamps_nested.length - 1]);

        disp.setFocusAxisLabels();

        // Display values on the context chart
        disp.context.y.domain([0, d3.max(data.time_totals)])
                .range([disp.context.height, 0]);

        disp.context.area
            .interpolate(options.shape.get());

//        disp.context.svg.selectAll(".x, .area").remove();
//        disp.context.svg.append("path")
//            .datum(data.time_totals)
//            .attr("class", "area")
//            .attr("d", disp.context.area);
//
//        disp.context.svg.append("g")
//            .attr("class", "x axis")
//            .attr("transform", "translate(0," + disp.context.height + ")")
//            .call(disp.context.xAxis);
//
//        disp.context.svg.append("g")
//            .attr("class", "x brush")
//            .call(disp.brush)
//            .selectAll("rect")
//            .attr("y", -6)
//            .attr("height", disp.context.height + 7);

        // Display the data
        disp.display();
    },
    get: function(found_in, tweet_type, keyword) {
        return 'a';
    },
    nestData: function() {
        
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
        
        
        
        console.log(shown);
        
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

        // Perform the nest
        var data_nested = d3.nest()
            .key(function (d) {
                var time = new Date(d.timestamp);
                if(options.resolution.is('tenminute'))
                    time.setMinutes(Math.floor(time.getMinutes() / 10) * 10);
                if(options.resolution.is('hour') || options.resolution.is("day"))
                    time.setMinutes(0);
                if(options.resolution.is("day"))
                    time.setHours(0);
                return time;
            })
            .rollup(function (leaves) {
                var newdata = {timestamp: leaves[0].timestamp};
                newdata['_total_'] = leaves.reduce(function(sum, cur) {
                    return sum + cur['_total_'];
                }, 0);

                if(options.series.is('none')) {
                    newdata['all'] = leaves.reduce(function(sum, leaf) {
                        return sum + leaf['_total_'];
                    }, 0);
                } else {
                    data.series.map(function(series) {
                        if(series.shown) {
                            newdata[series.name] = leaves.reduce(function(sum, leaf) {
                                return sum + leaf[series.name];
                            }, 0);
                        } else {
                            newdata[series.name] = 0;
                        }
                    });
                }

                return newdata;
            })
            .entries(data_nested_entries);
        
        return data_nested;
    },
    getCategorySubtotals: function() {
//        if(series_cat == 'Keyword')
        
        // Get the patterns that we want
        var found_in = options.found_in.get();
        
        var addToShownList = function(list, name, i) {
            if(data.series_byID[util.simplify(name)].shown) {
                list.push(i);
            }
            return list;
        }
        
        var shown = {
            y: legend.series_names['Tweet Type']
                        .reduce(addToShownList, []),
            d: legend.series_names['Distinctiveness']
                        .reduce(addToShownList, []),
            f: legend.series_names['Found In']
                        .reduce(addToShownList, []),
            k: legend.series_names['Keyword']
                        .reduce(addToShownList, [])
        }
        
        // Handle this later
//        if(shown.f.length == 
//           legend.series_names_nt['Found In'].length)
//            shown.f = [0];
//        if(shown.k.length == 
//           legend.series_names_nt['Keyword'].length)
//            shown.k = ['_total_'];
        
        
        
        // Filter dataset to just the visible data
//        var dataset = [];
        
//        shown.foundins.forEach(function(found_in) {
//            shown.distincts.forEach(function(distinct) {
//                shown.types.forEach(function(tweet_type) {
//                    shown.keywords.forEach(function (keyword) {
//                        data.timestamps.forEach(function (timestamp) {
//                            dataset.push({
//                                'Found In':        found_in,
//                                'Tweet Type':      tweet_type,
//                                'Distinctiveness': distinct,
//                                'Keyword':         keyword,
//                                timestamp:       util.date(timestamp),
//                                value: data.all[found_in][distinct][tweet_type][keyword][timestamp]
//                            });
//                        });
//                    });
//                });
//            });
//        });
//        legend.series_names['Found In'].forEach(function(found_in) {
//            legend.series_names['Distinctiveness'].forEach(function(distinct) {
//                legend.series_names['Tweet Type'].forEach(function(tweet_type) {
//                    legend.series_names['Keyword'].forEach(function (keyword) {
//                        data.timestamps.forEach(function (timestamp) {
//                            dataset.push({
//                                'Found In':        found_in,
//                                'Tweet Type':      tweet_type,
//                                'Distinctiveness': distinct,
//                                'Keyword':         keyword,
//                                timestamp:       util.date(timestamp),
//                                value: data.all[found_in][distinct][tweet_type][keyword][timestamp]
//                            });
//                        });
//                    });
//                });
//            });
//        });
//        data.dataset = dataset;
//        dataset2 = [];
//        legend.series_names['Found In'].forEach(function(found_in, i_f) {
//            var level1 = data.all[found_in];
//            legend.series_names['Distinctiveness'].forEach(function(distinct, i_d) {
//                var level2 = level1[distinct];
//                legend.series_names['Tweet Type'].forEach(function(tweet_type, i_y) {
//                    var level3 = level2[tweet_type];
//                    legend.series_names['Keyword'].forEach(function (keyword, i_k) {
//                        var level4 = level3[keyword];
//                        data.timestamps.forEach(function (timestamp, i_t) {
//                            dataset2.push([i_f, i_d, i_y, i_k, i_t, level4[timestamp]]);
//                        });
//                    });
//                });
//            });
//        });
//        data.dataset2 = dataset2;
        
        // Get nested timestamps
        data.timestamps_nested = d3.nest().key(function (d) {
            var time = util.date(d);
            if(options.resolution.is('tenminute'))
                time.setMinutes(Math.floor(time.getMinutes() / 10) * 10);
            if(options.resolution.is('hour') || options.resolution.is("day"))
                time.setMinutes(0);
            if(options.resolution.is("day"))
                time.setHours(0);
            return time;
        }).entries(data.timestamps);
        data.timestamps_nested = data.timestamps_nested.map(function(d) {
            return d.key;
        });

        // Get nested data
        legend.series_cats.forEach(function(category, i) {
            data.nestDataSubtotals(category, i, shown, data.all);
        });
    },
    nestDataTotals: function(category, cat_i) {
        var nest = d3.nest();
        
        // Category key
        nest.key(function(d) {
            return d[cat_i];
        });
        
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
                var id = util.simplify(legend.series_names[category][nested_entry.key]);
                var series_entry = data.series_byID[id];
                
                series_entry.sum = nested_entry.values;
            });
        } else { // Timestamps
            data.time_totals = nested_data.map(function(nested_entry) {
                return nested_entry.values;
            });
        }
    },
    nestDataSubtotals: function(category, cat_i, shown) {
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
                if(cat_i != 0 && !shown.y.includes(d[0]))
                    return 0;
                if(cat_i != 1 && !shown.d.includes(d[1]))
                    return 0;
                if(cat_i != 2 && !shown.f.includes(d[2]))
                    return 0;
                if(cat_i != 3 && !shown.k.includes(d[3]))
                    return 0;
                return d[5]; 
            });
        });
        
        var nested_data = nest.entries(data.all);
        nested_data.forEach(function(nested_entry) {
            var id = util.simplify(legend.series_names[category][nested_entry.key]);
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
                    value: value ? value : 0
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
