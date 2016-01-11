function Data() {
    var self = this;
    
    self.time = {
        timestamps: [],
        load_min: new Date(),
        load_max: new Date()
    };
    
    self.collection = {};
    self.collections = {};
    self.collection_names = [];
    self.data_stacked = {};
    self.series_data = {};
    self.data_raw = {};
    self.total_byTime = [];
    self.context_byTime = [];
    self.timestamps = {};
    self.timestamps_nested = {};
    self.keywords = {};
    self.series_names = {};
    self.stack = {};
    
    self.init();
}

Data.prototype = {
    init: function() {
        this.stack = d3.layout.stack()
            .values(function (d) { return d.values; })
            .x(function (d) { return d.timestamp; })
            .y(function (d) { return d.value; })
            .out(function (d, y0, y) { 
                d.y0 = y0;
                d.y = y;
                d.value0 = y0;
            })
            .order("reverse");
    },
    getCollections: function() {
        
    },
    loadDataFile: function(collection, subset, callback) {
        var url = "scripts/php/getTweetCounts.php";
        url += "?event_id=" + collection.ID;

        if(!options.time_limit.is('all')) {
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

            if(sign == -1)
                time_limit = new Date();
            else
                time_limit = new Date(this.getCurrentCollection().StartTime);

            time_limit.setHours(time_limit.getHours() + hours_diff * sign);

            if(sign == -1)
                url += '&time_min="' + util.formatDate(time_limit) + '"';
            else
                url += '&time_max="' + util.formatDate(time_limit) + '"';
        } 

        d3.csv(url, function(error, data_file) {
            if (error) {
                alert("Sorry! File not found");
                return;
            }

            // Get the timestamps
            data.timestamps = Array.from(new Set(data_file.map(function(d) {return d.Time}))).sort();
            if(data.timestamps.length == 0)
                data.timestamps = [util.formatDate(new Date())];
            data.keywords = Array.from(new Set(data_file.map(function(d) {return d.Keyword})));
            data.keywords = data.keywords.reduce(function(arr, word) {
                if(word != '_total_')
                    arr.push(word);
                return arr;
            }, [])

            // Fill in missing timestamps
            var first_timestamp = data.timestamps[0];
            var last_timestamp = data.timestamps[data.timestamps.length - 1];
            if(options.time_limit.get().slice(0, 1) == '-')
                last_timestamp = util.formatDate(new Date());

            var new_timestamps = [];

            for(var timestamp = new Date(first_timestamp);
                timestamp <= new Date(last_timestamp);
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
                            timestamp: new Date(timestamp),
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
            for(row in data_file) {
                var timestamp = data_file[row]['Time'];
                var found_in = data_file[row]['Found_In'];
                var keyword = data_file[row]['Keyword'];

                if(typeof data_file[row] !== 'object')
                    continue;

                data_raw0[found_in]['all'][timestamp][keyword] = parseInt(data_file[row]['Count']);
                data_raw0[found_in]['distinct'][timestamp][keyword] = parseInt(data_file[row]['Distinct']);
                data_raw0[found_in]['original'][timestamp][keyword] = parseInt(data_file[row]['Original']);
                data_raw0[found_in]['retweet'][timestamp][keyword] = parseInt(data_file[row]['Retweet']);
                data_raw0[found_in]['reply'][timestamp][keyword] = parseInt(data_file[row]['Reply']);
                data_raw0[found_in]['quote'][timestamp][keyword] = parseInt(data_file[row]['Quote']);
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
    //            
    //            for (var i = 0; i < timestamps.length; i++) {
    //                timestamp = timestamps[i];
    //                entry = {
    //                    timestamp: parseDate(timestamp),
    //                    '_total_': data_file[timestamp]["_total_"]
    //                };
    //                keywords.map(function(keyword) {
    //                    entry[keyword] = parseInt(data_file[timestamp][keyword]);
    //                });
    //                data_raw[subset].push(entry);
    //            }
    //        }

            callback();
        });
    },
    getCurrentCollection: function() {
        var collection_name = options.collection.getLabel();

        return data.collections.reduce(function(collection, candidate) {
            if(collection.Name == collection_name)
                return collection;
            return candidate
        }, {});
    },
    loadCollectionData: function() {
        disp.toggleLoading(true);

        var collection = data.getCurrentCollection();
        if($.isEmptyObject(collection)) {
            disp.toggleLoading(false);
            return;
        }

        data.all = {};
        var subset_to_start = 'all'; //options.subset.get();

        // Load the collection's primary file
        data.loadDataFile(collection, subset_to_start, function() {

            // Get the keywords
    //        keywords = d3.keys(data_raw[subset_to_start][0]).filter(function (key) {
    //            return key !== "timestamp" && key !== '_total_';
    //        });

            // Set Time Domain and Axis
            var x_min = data.all['Any'][subset_to_start][0].timestamp;
            var x_max = data.all['Any'][subset_to_start][data.all['Any'][subset_to_start].length - 1].timestamp;
            disp.focus.x.domain([x_min, x_max]).clamp(true);
            disp.context.x.domain([x_min, x_max]);

            // Clear brush
            disp.brush.clear();
            disp.plot_area.svg.selectAll('.brush').call(disp.brush);

    //        // Load the rest of the data (asychronous) // no unnecessary
    //        options.subset.ids.map(function(subset) {
    //            loadDataFile(collection.Name, subset, function() {});
    //        });

            data.changeSeries(subset_to_start);
        });
    },
    loadNewSeriesData: function(subset) {
        var found_in = options.found_in.get();
        data.series_data = data.series_names.map(function(name, i) {
            return {
                name: name,
                id: util.simplify(name),
                order: (i + 1) * 100,
                shown: true
            };
        });

        if(options.series.is('terms')) {
            var collection = data.getCurrentCollection();

            data.series_data.map(function(datum) {
                datum.isKeyword = collection.Keywords.reduce(function(prev, keyword) {
                    return prev |= keyword.toLowerCase() == datum.name.toLowerCase();
                }, false);
                datum.isOldKeyword = collection.OldKeywords.reduce(function(prev, keyword) {
                    return prev |= keyword.toLowerCase() == datum.name.toLowerCase();
                }, false);

                datum.sum = data.all[found_in]['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint[datum.name];
                }, 0);
            });
        } else if(options.series.is('types')) {
            data.series_data.map(function(datum) {
                datum.sum = data.all[found_in][datum.name].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint['_total_'];
                }, 0);
            });
        } else if(options.series.is('distinct')) {
            data.series_data.map(function(datum) {
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
            data.series_data[1].sum -= data.series_data[0].sum;
        } else { // implicit none
            data.series_data.map(function(datum) {
                datum.sum = data.all[found_in]['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint['_total_'];
                }, 0);
            });
        }
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

        // Load the main series
        data.loadNewSeriesData(subset);

        // Build Legend    
        legend.populate(data.series_data);

        // Finish preparing the data for loading
        data.prepareData();   
    },
    changeData: function() {
        data.loadNewSeriesData(options.subset.get());

        data.prepareData();
    },
    prepareData: function() {
        var found_in = options.found_in.get();

        // If we haven't loaded the data yet, tell the user and ask them to wait
        if(data.all[found_in][options.subset.get()] == undefined) {
            // Wait a second, then if it still isn't ready, message user that they are waiting
            window.setTimeout(function() {
                if(data.all[found_in][options.subset.get()] == undefined) {
                    if (confirm(
                        getCurrentCollection().name + ": " + 
                        options.subset.get() + " _total_" +
                        " not loaded yet. \n\n" +
                        "Press OK to try again.")
                       ) {
                        window.setTimeout(prepareData, 1000);
                    } else {
                        // Should mark that the visualization is out of date or something
                    }
                    return;
                } else {
                    data.prepareData();
                }
            }, 1000);
            return;
        }

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
                    data.series_data.map(function(series) {
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

        timestamps_nested = data_nested.map(function(item) { return item.key; });

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

        data.total_byTime = data_ready.map(function(datum) {
            return Math.max(data.series_names.reduce(function(running_sum, word) {
                return running_sum += datum[word];
            }, 0), 1);
        });
        data.context_byTime = data_ready.map(function(datum) {
            return {timestamp: datum.timestamp, value: datum['_total_']};
        });

        // Reorder by total size
        data.series_data.sort(util.compareSeries);
        legend.container_series.selectAll('div.legend_entry').sort(util.compareSeries);
        disp.setColors();

        // Add the nested data to the series
        data.series_data.map(function(datum) {

            datum.values = data_ready.map(function(d) {
                return {timestamp: d.timestamp, value: d[datum.name]};
            });
            datum.max = data_ready.reduce(function(cur_max, d) {
                return Math.max(cur_max, d[datum.name]);
            }, 0);
        });

        // Set Time Domain and Axis appropriate to the resolution
        disp.setContextTime(data_ready[0].timestamp, data_ready[data_ready.length - 1].timestamp);

        // Display the xAxis
        var ax = disp.focus.svg.select("g#xAxis");
        if(!ax[0][0])
            ax = disp.focus.svg.append('g').attr('id', 'xAxis');
        ax.attr('class','x axis')
            .attr('transform', 'translate(0,' + disp.focus.height + ')')
            .transition().duration(1000)
            .call(disp.focus.xAxis);

        // Set the Y-Axis label
        disp.focus.svg.select('#y_label')
            .text("Count of " + options.subset.getLabel() + " Tweets"
                  + " Every " + options.resolution.getLabel() + "");

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
    genTweetCount: function() {
        var event_id = data.getCurrentCollection().ID;
        var search_term = options.add_term.get().toLowerCase();
        // Generate PHP query
        var url = "scripts/php/genTweetCounts.php";
        url += "?event_id=" + event_id;
        url += '&time_min="' + util.formatDate(options.time_min.min) + '"';
        url += '&time_max="' + util.formatDate(options.time_max.max) + '"';
        url += '&text_search=' + search_term;
        console.info(url);

        // Start progress bar
        options.add_term.reset();
        $("#input_add_term").blur();
        d3.select("#choose_add_term").append('div')
            .attr('id', 'new_keyword_progress_div')
            .attr('class', 'progress')
            .style({
                position: 'absolute',
                top: '0px',
                left: '0px',
                width: '100%',
                height: '100%',
                opacity: 0.5,
                'z-index': 3
            })
            .append('div')
            .attr({
                id: "new_keyword_progress",
                class: "progress-bar progress-bar-striped active",
                role: "progressbar",
                'aria-valuenow': "100",
                'aria-valuemin': "0",
                'aria-valuemax': "100",
            })
            .style('width', '100%');

        var timescale = d3.time.scale()
            .range([0, 100])
            .domain(disp.context.x.domain());

    //    var check = setInterval(function() {
    //        var url = "scripts/php/getEventTweetCount_Keyword_Stats.php";
    //        url += "?event_id=" + event_id;
    //        url += '&keyword=' + search_term;
    //        
    //        d3.json(url, function(error, data) {
    //            if(error) return;
    //            var progress = Math.floor(timescale(new Date(data[0].time)));
    //            d3.select('#new_keyword_progress')
    //                .attr('aria-valuenow', progress + "")
    //                .style('width', progress + "%");
    //        });
    //    }, 2000);

        d3.text(url, function(error, file_data) {
            console.debug(error);
            console.info(file_data);
            if(error || file_data.substring(0, 7) != "REPLACE") {
                alert("Problem generating new series");
            }

            d3.select('#new_keyword_progress_div').remove();
    //        clearInterval(check);
            data.loadCollectionData();
        });
    },
    getTweets: function(series, startTime, stopTime) {
        var url = "scripts/php/getTweets.php";
        url += "?event_id=" + data.getCurrentCollection().ID;
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
