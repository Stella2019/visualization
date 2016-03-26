/*global data, disp, legend, util, options, d3, console */

function Data() {
    var self = this;
    
    // Time
    self.time = {
        name: "Time",
        collection_min: new Date(),
        collection_max: new Date(),
        min: new Date(), // of possible data
        max: new Date(), // of possible data
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
    self.ngrams = {
        main: {},
        cmp: {},
        exclude_stopwords: true,
        relative: true
    };
}
Data.prototype = {
    loadEventTimeseries: function () {
        // If there is no event information, end, we cannot do this yet
        if ($.isEmptyObject(data.event)) {
            return;
        }

        // Clear the raw data objects
        data.file = [];
        data.all = {};
        
        // Load information about the rumors related to the event
        data.loadRumors();
        
        d3.select('#choose_Dataset_Event button')
            .attr('disabled', true);
        
        // Send a signal to start loading the event
        var args = {
            name: 'load_event_timeseries',
            url: 'timeseries/get',
            post: {event_id: data.event.ID},
            time_min: new Date(options['Dataset']['Time Min'].date),
            time_max: new Date(options['Dataset']['Time Max'].date),
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
        Connection.php('collection/getRumors',
                     {event_id: data.event.ID},
                     data.parseRumorsFile);
    },
    parseRumorsFile: function(filedata) {
        filedata = JSON.parse(filedata);
        
        data.rumors = filedata;
        
        // Populate the list of options
        options.buildRumors();
    },
    setRumor: function() {
        var rumor_id = options['Dataset']['Rumor'].get();
        
        data.rumor = data.rumors.reduce(function(rumor, candidate) {
            if(rumor.ID == rumor_id)
                return rumor;
            return candidate
        }, {});
        
        // No future callbacks from this
    },
    parseLoadedTimeseries: function() {
        // Format selections
        d3.select('#choose_Dataset_Event button')
            .attr('disabled', null);
        
        // If there is no data, abort the pipeline
        if(data.file.length == 0) {
            disp.alert('No Timeseries Data in Database');
            
            // Hardcode the max/min time
            options['View']['Time Min'].min = new Date(options['Dataset']['Time Min'].date);
            options['View']['Time Max'].max = new Date(options['Dataset']['Time Max'].date);
            
            pipeline.abort();
            return;
        }
        
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
//        if(options.time_limit.get().slice(0, 1) == '-')
//            last_timestamp = util.formatDate(new Date());

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
                
                // Fix for FoundIn Any/Text
                if(i_f > 0 && data.all[i_y][i_d][0][i_k][i_t] == 0) {
                    data.all[i_y][i_d][0][i_k][i_t] = 
                        parseInt(data.file[row][tweet_type]);
                }
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
        
        // Update NGram list to allow searches on keywords
        options.buildNGrams();
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
        if(options['Series']['Chart Category'].is('Keyword')) {
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
        entry.isKeyword = data.event.Keywords.reduce(function(prev, keyword) {
            return prev |= keyword.toLowerCase().replace('#', '') == entry.name.toLowerCase().replace('#', '');
        }, false);
        entry.isOldKeyword = data.event.OldKeywords.reduce(function(prev, keyword) {
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
        
        // All series
        if(!data.cats['Found In'].filter
           && data.shown[2].includes(1)
           && data.shown[2].includes(2)
           && data.shown[2].includes(3)) {
            data.shown[2] = [0];
        }
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
        var time;
        if(typeof(d) == "string")
            time = util.date(d);
        else
            time = new Date(d);
        time.setMilliseconds(0);
        time.setSeconds(0);
        if(options['View']['Resolution'].is('tenminute'))
            time.setMinutes(Math.floor(time.getMinutes() / 10) * 10);
        if(options['View']['Resolution'].is('hour') || options['View']['Resolution'].is("day"))
            time.setMinutes(0);
        if(options['View']['Resolution'].is("day"))
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
        if (options['View']['Plot Type'].is("wiggle")) {
            data.stack.offset("wiggle");
        } else if (options['View']['Plot Type'].is("stream_expand")) {
            data.stack.offset("expand");
        } else if (options['View']['Plot Type'].is("stream")) {
            data.stack.offset("silhouette");
        } else {
            data.stack.offset("zero");
        }

        // Find out what we are plotting
        var category = options['Series']['Chart Category'].get();
        var data_to_plot = data.cats[category].series_plotted;
        
        // Set legend filter buttons
        legend.configureFilters();
        
        // Set stack representation of data
        if(options['View']['Plot Type'].is("percent")) {
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
        if(options['View']['Plot Type'].is("separate")) {
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
    updateEvent: function() {
        var fields = {};
        $("#edit_form").serializeArray().forEach(function(x) { fields[x.name] = x.value; });
        
        Connection.php('collection/update', fields, options.editWindowUpdated); // add a callback
    },
    rmTweetCount: function(search_text, search_name) {
        var post = {
            event_id: data.event.ID,
            keyword: search_name,
        };
        if(search_text == 'rumor') {
            post.keyword = data.rumor.ID;
        }
        
        Connection.php('timeseries/rm', post, function() {
            data.genTweetCount(search_text, search_name);
        });
    },
    genTweetCount: function(search_text, search_name) {
        var post = {
            event_id: data.event.ID,
            search_name: search_name,
            search_text: search_text
        };
        
        // Generate fields
        if(!post.search_name)
            post.search_name = post.search_text;
        
        post.search_text = post.search_text
            .replace(/\\W(.*)\\W/g, "[[:<:]]$1[[:>:]]");
        
        var progress_div = '#choose_Series_Add_Term';
        if(search_text == 'rumor') {
            post.rumor_id = data.rumor.ID;
            post.search_name = data.rumor.ID;
            progress_div = '#edit-window-gencount-div';
        } else {
            options['Series']['Add Term'].reset();
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
            on_finish: data.loadEventTimeseries
        };
        
        var stream = new Connection(args);
        
        // Wait to start it so graphical changes can propagate
        setTimeout(function() {
            stream.start();
        }, 10);
    },
    getTweets: function(args) {
        var post = {
            event_id: data.event.ID
        };
        var title = "";

        if(options['Analysis']['Fetched Tweet Order'].is("rand")) {
            post.rand = true;
        } else if(options['Analysis']['Fetched Tweet Order'].is("prevalence")) {
            post.order_prevalence = true;
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
            args.time_min = options['View']['Time Min'].min;
        if(!('time_max' in args))
            args.time_max = options['View']['Time Max'].max;

        post.time_min = util.formatDate(args.time_min);
        title += " between <br />" + util.formatDate(args.time_min);
        post.time_max = util.formatDate(args.time_max);
        title += " and " + util.formatDate(args.time_max);
        
        if('csv' in post) {
            Connection.php('tweets/get', post, data.handleTweets, function() { 
                disp.alert('Unable to retreive tweets', 'danger');
            });
        } else {
            disp.tweetsModal(post, title);
        }
    },
    getRumor: function() {
        var post = {
            rumor_id: options['Dataset']['Rumor'].get(),
            event_id: data.event.ID,
            time_min: util.formatDate(data.time.min),
            time_max: util.formatDate(data.time.max)
        }
//        url += '&definition="' + "hello" + '"';
//        url += '&query="' + "pzbooks|[[:<:]]bot[[:>:]],know|knew|predict|before|[[:<:]]11[[:>:]]|early" + '"';
        
        if(options['Dataset']['Rumor'].is('_new_'))
            post.url = "new";
        if(options['Dataset']['Rumor'].is('_none_'))
            return; // End this, there is no rumor to get
        
        Connection.php('collection/getRumor', post, function(d) {
            try {
                data.rumor = JSON.parse(d)[0];
//                delete data.rumor['StartTime'];
//                delete data.rumor['StopTime']; 
            } catch (e) {
                console.log(d);
            }
        });
    },
    getRumorCount: function() {
        var post = {
            event_id: data.event.ID,
            rumor_id: data.rumor.ID,
            time_min: util.formatDate(options['Dataset']['Time Min'].date),
            time_max: util.formatDate(options['Dataset']['Time Max'].date),
            total: ''
        };
        
        Connection.php('collection/countTweetIn', post, function(file_data) {
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
                event_id: data.event.ID,
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
        Connection.php('collection/rmTweetIn', args.post, function() {
            // Initialize and start Stream
            var stream = new Connection(args);
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
    },
    calculateNGrams: function(selector) {
        var ngrams = data.ngrams.main;
        if(selector == 'ngram_cmp')
            ngrams = data.ngrams.cmp;
        var spec = options[selector].get();
        
        ngrams.nTweets = 0;
        ngrams.TweetCounter = new Counter();
        ngrams.nGrams = d3.range(3).map(function(d) {
            return 0;
        });
        ngrams.NGramCounter = d3.range(3).map(function(d) {
            return new Counter();
        })
        
        post = { 
            event_id: data.event.ID,
            limit: 100000
        };
        if(spec.substring(0, 2) == 'k_') {
            var series = data.series[spec.substring(2)];
            post.search_text = data.series.name;
        } else if(spec.substring(0, 2) == 'r_') {
            post.rumor_id = spec.substring(2);
        }
        // Add filters
        var category = data.cats['Distinctiveness'];
        var shown = data.shown[category.data_index];
        if(shown.length != 2) {
            var distinct = category.series_names[shown[0]];
            post.distinct = distinct == 'distinct' ? 1 : 0;
        }
        category = data.cats['Tweet Type'];
        shown = data.shown[category.data_index];
        if(shown.length != 4) {
            var types = shown.map(function(i) {
                return category.series_names[i];
            });
            post.type = types.join("','");
        }
        ngrams.post = post;
        
        var stream = new Connection({
            progress_text: "Fetching NGrams from Tweets",
            url: "tweets/getTextNoURL",
            post: post,
            time_res: 1,
            on_chunk_finish: function(file_data) { 
                data.parseNGrams(file_data, selector);
            },
            on_finish: function() { 
                disp.nGramModal(selector);
            }
        });
        
        stream.start();
    },
    parseNGrams: function(file_data, selector) {
        var ngrams = data.ngrams.main;
        if(selector == 'ngram_cmp')
            ngrams = data.ngrams.cmp;
        
        // Parse tweet JSON
        var tweets;
        try {
            tweets = JSON.parse(file_data);
        } catch(err) {
            console.log(file_data);
            throw(err);
            return;
        }

        // For each Tweet
        tweets.forEach(function(tweet) {
            if(ngrams.post.distinct &&  ngrams.TweetCounter.has(tweet.TextNoURL)) {
                return;
            }
            
            ngrams.nTweets += 1;
            ngrams.TweetCounter.incr(tweet.TextNoURL);
            
            var text = tweet.TextNoURL.toLowerCase();
            text = text.replace(/[^\w']+/g, ' ');
            text = text.replace(/\w' | '\w/g, ' ');
            var words = text.split(' ');
            var tweetgrams = [new Set(), new Set(), new Set()];
            
            words.map(function(word, wi) {
                if(word) {
                    var gram = word;
                    if(!tweetgrams[0].has(gram)) {
                        tweetgrams[0].add(gram);
                        ngrams.nGrams[0] += 1;
                        ngrams.NGramCounter[0].incr(gram);
                    }
                    if(words[wi + 1]) {
                        gram += " " + words[wi + 1];
                        if(!tweetgrams[1].has(gram)) {
                            tweetgrams[1].add(gram);
                            ngrams.nGrams[1] += 1;
                            ngrams.NGramCounter[1].incr(gram);
                        }
                        if(words[wi + 2]) {
                            gram += " " + words[wi + 2];
                            if(!tweetgrams[2].has(gram)) {
                                tweetgrams[2].add(gram);
                                ngrams.nGrams[2] += 1;
                                ngrams.NGramCounter[2].incr(gram);
                            }
                        }
                    }
                    // Add co-occurance
                }
            });
        });
        
        // Clear rare
//        ngrams.NGramCounter[0].purgeBelow(2);
//        ngrams.NGramCounter[1].purgeBelow(2);
//        ngrams.NGramCounter[2].purgeBelow(2);
    },
    rmCodeCount: function(search_text, search_name) {
        var post = {
            event_id: data.event.ID,
            keyword: search_name,
        };
        if(search_text == 'rumor') {
            post.keyword = data.rumor.ID;
            d3.select('#edit-window-gencount')
                .attr('disabled', '');
        }
        
        Connection.php('timeseries/rm', post, function() {
            data.genTweetCount(search_text, search_name);
        });
    },
    genCodeCount: function(search_text, search_name) {
        var post = {
            event_id: data.event.ID,
            search_name: search_name,
            search_text: search_text
        };
        
        // Generate fields
        if(!post.search_name)
            post.search_name = post.search_text;
        
        post.search_text = post.search_text
            .replace(/\\W(.*)\\W/g, "[[:<:]]$1[[:>:]]");
        
        var progress_div = '#choose_Series_Add_Term';
        if(search_text == 'rumor') {
            post.rumor_id = data.rumor.ID;
            post.search_name = data.rumor.ID;
            progress_div = '#edit-window-gencount-div';
            d3.select('#edit-window-gencount')
                .attr('disabled', null);
        } else {
            options['Series']['Add Term'].reset();
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
            on_finish: data.loadEventTimeseries
        };
        
        var stream = new Connection(args);
        stream.start();
    }
}
