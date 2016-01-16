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
//        disp.toggleLoading(true);

        // Collection selection
        d3.json("scripts/php/getCollections.php", data.parseCollectionsFile);
    },
    parseCollectionsFile: function(error, collections_file) {
        if (error) throw error;

        // Add collections
        collections_file.sort(util.compareCollections);
        collections_file.reverse();
        data.collections = collections_file;

        
        // Format collection data
        data.collections.map(function(collection) {
            // Keywords
            collection.Keywords = collection.Keywords.trim().split(/,[ ]*/);
            collection.OldKeywords = collection.OldKeywords.trim().split(/,[ ]*/);
            if(collection.OldKeywords.length == 1 && collection.OldKeywords[0] == "")
                collection.OldKeywords = [];
            
            // Name
            if(!('DisplayName' in collection) || !collection['DisplayName'] || collection['DisplayName'] == "null")
                collection.DisplayName = collection.Name;
               
            // Time
            collection.StartTime = util.date(collection.StartTime);
            collection.StartTime.setMinutes(collection.StartTime.getMinutes()
                                           -collection.StartTime.getTimezoneOffset());
            collection.Month = util.date2monthstr(collection.StartTime);
            if(collection.StopTime) {
                collection.StopTime = util.date(collection.StopTime);
                if(collection.StartTime.getMonth() != collection.StopTime.getMonth()) 
                    collection.Month += ' to ' + util.date2monthstr(collection.StopTime);
            } else {
                collection.StopTime = "Ongoing";
                collection.Month += '+';
            }
            collection.DisplayName += ' ' + collection.Month;
        });

        
        // Make nicer collection names
        data.collection_names = data.collections.map(function(collection) {
            return collection.DisplayName;
        });
        
        options.buildCollections();

        // Initialize Legend
        legend = new Legend();
        legend.init();

        data.setCollection();
    },
    setCollection: function() {
        var collection_id = options.collection.get();
        
        data.collection = data.collections.reduce(function(collection, candidate) {
            if(collection.ID == collection_id)
                return collection;
            return candidate
        }, {});
        
        disp.setTitle();
        
        data.loadCollectionData();
    },
    loadCollectionData: function() {
//        disp.toggleLoading(true);

        // If there is no collection information, end, we cannot do this yet
        if($.isEmptyObject(data.collection)) {
//            disp.toggleLoading(false);
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
            var time_limit = options.time_limit.get()
            var sign = time_limit.slice(0, 1) == '-' ? -1 : 1;

            time_limit = time_limit.slice(-2);
            var hours_diff = 0;

            if(time_limit == '3h') {
                hours_diff = 3;
            } else if(time_limit == '2h') { // 12h, but we sliced it
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
        
        // Send a signal to start loading the collection
        data.startLoadingCollection();
    },
    startLoadingCollection: function() {
        // Determine the base URL
        var url = "scripts/php/getTweetCounts.php";
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

        data.changeSeries('all');
    },
    changeSeries: function(subset) {
        // Determine the series on the chart
        if(options.series.is('terms')) {
            data.series_names = data.keywords;
        } else if(options.series.is('types')) {
            data.series_names = ['original', 'retweet', 'reply', 'quote'];
        } else if(options.series.is('distinct')) {
            data.series_names = ['distinct', 'repeat'];
        } else {
            data.series_names = ['all'];
        }
        
        // Start the series data store
        data.series = data.series_names.map(function(name, i) {
            return {
                name: name,
                id: util.simplify(name),
                order: (i + 1) * 100,
                shown: true
            };
        });
        
        // Copy it to the search_by_id
        data.series_byID = {};
        data.series.map(function(series) {
            data.series_byID[series.id] = series;
        });

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

        // Fill in specifics of the series
        if(options.series.is('terms')) {
            data.series.map(function(datum) {
                datum.isKeyword = data.collection.Keywords.reduce(function(prev, keyword) {
                    return prev |= keyword.toLowerCase() == datum.name.toLowerCase();
                }, false);
                datum.isOldKeyword = data.collection.OldKeywords.reduce(function(prev, keyword) {
                    return prev |= keyword.toLowerCase() == datum.name.toLowerCase();
                }, false);

                datum.sum = data.all[found_in]['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint[datum.name];
                }, 0);
            });
        } else if(options.series.is('types')) {
            data.series.map(function(datum) {
                datum.sum = data.all[found_in][datum.name].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint['_total_'];
                }, 0);
            });
        } else if(options.series.is('distinct')) {
            data.series.map(function(datum) {
                if(datum.name == 'distinct')
                    datum.sum = data.all[found_in]['distinct'].reduce(function(cur_sum, datapoint) { // Can change subset
                        return cur_sum + datapoint['_total_'];
                    }, 0);
                else
                    datum.sum = data.all[found_in]['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                        return cur_sum + datapoint['_total_'];
                    }, 0);
            });

            // Subtract the distinct sum from the all sum to make the repeat sum, presuming repeat is in the second place
            data.series[1].sum -= data.series[0].sum;
        } else { // implicit none
            data.series.map(function(datum) {
                datum.sum = data.all[found_in]['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint['_total_'];
                }, 0);
            });
        }
    },
    prepareData: function() {
        var found_in = options.found_in.get();
        
        // If we haven't loaded the data yet, tell the user and ask them to wait
        if(!('Text' in data.all) || data.all[found_in][options.subset.get()] == undefined) {
            // Wait a second, then if it still isn't ready, message user that they are waiting
//            window.setTimeout(function() {
//                if(!('Text' in data.all) || data.all[found_in][options.subset.get()] == undefined) {
//                    if (confirm(
//                        data.collection.name + ": " + 
//                        options.subset.get() + " _total_" +
//                        " not loaded yet. \n\n" +
//                        "Press OK to try again.")
//                       ) {
//                        window.setTimeout(data.prepareData, 1000);
//                    } else {
//                        // Should mark that the visualization is out of date or something
//                    }
//                    return;
//                } else {
//                    data.prepareData();
//                }
//            }, 1000);
            return;
        }
        
        var data_nested = data.nestData();

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
    nestData: function() {
        var found_in = options.found_in.get();
        
        // Aggregate on time depending on the resolution
        var data_nested_entries;
        if(options.series.is('types')) {
            data_nested_entries = []; // think about it
            for(var i = 0; i < data.all[found_in]['all'].length; i++) {
                entry = {
                    timestamp: data.all[found_in]['all'][i]['timestamp'],
                    _total_: data.all[found_in]['all'][i]['_total_'],
                    original: data.all[found_in]['original'][i]['_total_'],
                    retweet: data.all[found_in]['retweet'][i]['_total_'],
                    reply: data.all[found_in]['reply'][i]['_total_'],
                    quote: data.all[found_in]['quote'][i]['_total_']
                }
                data_nested_entries.push(entry);
            }
        } else if(options.series.is('distinct')) {
            data_nested_entries = []; // think about it
            for(var i = 0; i < data.all[found_in]['all'].length; i++) {
                entry = {
                    timestamp: data.all[found_in]['all'][i]['timestamp'],
                    _total_: data.all[found_in]['all'][i]['_total_'],
                    distinct: data.all[found_in]['distinct'][i]['_total_'],
                    repeat: data.all[found_in]['all'][i]['_total_'] - data.all[found_in]['distinct'][i]['_total_'],
                }
                data_nested_entries.push(entry);
            }
        } else {
            data_nested_entries = data.all[found_in][options.subset.get()];
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
    genTweetCount: function() {
        var event_id = data.collection.ID;
        var search_term = options.add_term.get().toLowerCase();
        
        // Generate PHP query
        var url = "scripts/php/genTweetCounts.php";
        url += "?event_id=" + event_id;
        url += '&text_search=' + search_term;
        
        // Calculate time periods to add to the event
        var time_min = options.time_min.min;
        var time_max = options.time_max.max;
        
        // Generate a list of times every 6 hours
        var time_chunks = [];
        for(var timestamp = new Date(time_min);
            timestamp < time_max;
            timestamp.setMinutes(timestamp.getMinutes() + 60 * 1)) {
            time_chunks.push(util.formatDate(timestamp));
        }
        time_chunks.push(util.formatDate(time_max));
        
        // Start progress bar
        options.add_term.reset();
        $("#input_add_term").blur();
        
        disp.startProgressBar('new_keyword');
        
        // Send off the first chunk of time to generate tweet counts
        data.genTweetCountChunk(url, time_chunks, 0);
    },
    genTweetCountChunk: function(url_base, time_chunks, index) {
        // If we are at the max, end
        if(index >= time_chunks.length - 1) {
            // Load the new data
            data.startLoadingCollection();
            
            // End the progress bar and stop function
                disp.endProgressBar('new_keyword');
            return;
        }
    
        var url = url_base;
        url += '&time_min="' + time_chunks[index] + '"';
        url += '&time_max="' + time_chunks[index + 1] + '"';
//        console.info(url);
    
        d3.text(url, function(error, file_data) {
            if(error || file_data.substring(0, 7) != "REPLACE") {
                console.debug(error);
                console.debug(file_data);
                
                // Abort
                disp.alert("Problem generating new series from terms");
                disp.endProgressBar('new_keyword');
                return;
            }
            
            // Update the progress bar
            disp.updateProgressBar('new_keyword',
                                   Math.floor((index + 1) / (time_chunks.length - 1) * 100));
            
            // If success, load the new data
//            data.loadDataFile();
            console.debug(file_data);

            // Start loading the next batch
            data.genTweetCountChunk(url_base, time_chunks, index + 1);
        });
    },
    getTweets: function(series, startTime, stopTime) {
        var url = "scripts/php/getTweets.php";
        url += "?event_id=" + data.collection.ID;
        var title = "";

        if(options.subset.is("distinct")) {
            url += '&distinct=1';
            title += 'Distinct ';
        } else if(!options.subset.is('all')) {
            url += '&type=' + options.subset.get();
            title += options.subset.getLabel() + ' ';
        }
        title += 'Tweets';

        if(options.series.is("terms")) {
    //        if(series.name.split(" ").length > 1)
    //            url += '&text_search="' + series.name.split(" ").join("|") + '"';
    //        else
                url += '&text_search=' + series.name;
            title += ' with text "' + series.name + '"';
        } else if(options.series.is("types")) {
            url += '&type=' + series.name;
            title += ' of type ' + series.name;
        } else if(options.series.is("distinct")) {
            url += '&distinct=' + (series.name == "distinct" ? 1 : 0);
            title += ' that are ' + (series.name == "distinct" ? 'distinct' : 'not distinct')
        }

    //    startTime.setHours(startTime.getHours() - 8); // temporary UTC/PST fix
        url += '&time_min="' + util.formatDate(startTime) + '"';
        title += " between <br />" + util.formatDate(startTime);

    //    stopTime.setHours(stopTime.getHours() - 8); // temporary UTC/PST fix
        url += '&time_max="' + util.formatDate(stopTime) + '"';
        title += " and " + util.formatDate(stopTime);

        console.info(url);
        d3.text(url, function(error, filedata) {

            d3.select('#selectedTweetsModal .modal-title')
                .html(title);

            var modal_body = d3.select('#selectedTweetsModal .modal-body');
            modal_body.selectAll('*').remove();

            if(filedata.indexOf('Maximum execution time') >= 0) {
                modal_body.append('div')
                    .attr('class', 'text-center')
                    .html("Error retrieving tweets. <br /><br /> Query took too long");
            } else if (filedata.indexOf('Fatal error') >= 0 || filedata.indexOf('Errormessage') >= 0) {
                modal_body.append('div')
                    .attr('class', 'text-center')
                    .html("Error retrieving tweets. <br /><br /> " + filedata);
            } else if (error) {
                modal_body.append('div')
                    .attr('class', 'text-center')
                    .html("Error retrieving tweets. <br /><br /> " + error);
            } else {
                filedata = JSON.parse(filedata);

                if(data.length == 0) {
                    modal_body.append('div')
                        .attr('class', 'text-center')
                        .text("No tweets found in this selection.");
                } else {
                    modal_body.append('ul')
                        .attr('class', 'list-group')
                        .selectAll('li').data(filedata).enter()
                        .append('li')
                        .attr('class', 'list-group-item')
                        .html(function(d) {
                            var content = "<span class='badge'># " + d['ID'] + " </span>";
                            content += d['Timestamp'] + ' ';
                            content += d['Username'] + " said: ";
                            content += "<br />";
                            content += d['Text'];
                            content += "<br />";
                            if(d['Distinct'] == '1')
                                content += 'distinct ';
                            content += d['Type'];
                            if(d['Origin'])
                                content += ' of # ' + d['Origin']
                            return content;
                        });

                    d3.json(url.replace('getTweets.php', 'getTweets_Count.php'), function(count) {
                        d3.select('#selectedTweetsModal .modal-title')
                            .html(count[0]['count'] + " " + title);
                    });
                }
            }

            $('#selectedTweetsModal').modal();
        });
    }
}
