Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

var collections;
var collection_names = [];
var data_stacked, series_data, data_raw;
var total_byTime, context_byTime;
var timestamps, timestamps_nested, keywords, series_names;
var options = new Options();

window.onload = initialize;

var formatDate,
    color,
    area, stack,
    brush, spin;
var plot_area, focus, context, legend;

function initialize() {
    focus = {}; context = {};
    
    plot_area      = {height: 500, width: 960};
    focus.margin   = {top: 10,  right: 10, bottom: 100, left: 75};
    context.margin = {top: 430, right: 10, bottom: 20,  left: 75};
    focus.width    = plot_area.width  - focus.margin.left - focus.margin.right;
    focus.height   = plot_area.height - focus.margin.top  - focus.margin.bottom;
    context.width  = focus.width;
    context.height = plot_area.height - context.margin.top - context.margin.bottom;

    formatDate = d3.time.format("%Y-%m-%d %H:%M:%S");

    focus.x = d3.time.scale()
        .range([0, focus.width]);
    context.x = d3.time.scale()
        .range([0, context.width]);

    focus.y = d3.scale.linear()
        .range([focus.height, 0]);
    focus.y_context = d3.scale.linear()
        .range([focus.height, 0]);
    context.y = d3.scale.linear()
        .range([context.height, 0]);

    setColorScale();

    focus.xAxis = d3.svg.axis()
        .scale(focus.x)
        .tickSize(-focus.height)
        .orient("bottom");
    
    context.xAxis = d3.svg.axis()
        .scale(context.x)
        .orient("bottom");
    
    focus.yAxis = d3.svg.axis()
        .scale(focus.y)
        .orient("left");
    focus.yAxis_context = d3.svg.axis()
        .scale(focus.y_context)
        .orient("right");
    
    context.yAxis = d3.svg.axis()
        .scale(context.y)
        .ticks(2)
        .orient("left");

    brush = d3.svg.brush()
        .x(context.x)
        .on("brush", function() { setFocusTime('brush'); } );
    
    var opts = {
        lines: 11,
        color: '#000',
        length: 50,
        width: 10,
        radius: 25,
        top: focus.margin.top + focus.height / 2 + "px",
        left: focus.margin.left + focus.width / 2 + "px"
    };
    
    spin = new Spinner(opts);
    
    focus.area = d3.svg.area()
        .interpolate(options.shape.get())
        .x(function (d) { return focus.x(d.timestamp); });
    focus.area_context = d3.svg.area()
        .interpolate(options.shape.get())
        .x(function (d) { return focus.x(d.timestamp); });

    context.area = d3.svg.area()
        .interpolate(options.shape.get())
        .x(function(d) { return context.x(d.timestamp); })
        .y0(context.height)
        .y1(function(d) { return context.y(d._total_); });
    
    stack = d3.layout.stack()
        .values(function (d) { return d.values; })
        .x(function (d) { return d.timestamp; })
        .y(function (d) { return d.value; })
        .out(function (d, y0, y) { 
            d.y0 = y0;
            d.y = y;
            d.value0 = y0;
        })
        .order("reverse");
    
    plot_area.svg = d3.select("svg#timeseries")
        .attr("width", plot_area.width)
        .attr("height", plot_area.height);

    focus.svg = plot_area.svg.append("g")
        .attr("class", "focus")
        .attr("transform", "translate(" + focus.margin.left + "," + focus.margin.top + ")");
    
    context.svg = plot_area.svg.append("g")
        .attr("class", "context")
        .attr("transform", "translate(" + context.margin.left + "," + context.margin.top + ")");
    
    focus.svg.append("text")
        .attr('id', 'y_label')
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - focus.margin.left)
        .attr("x", 0 - (focus.height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Count of <Subset> Tweets Every <Resolution>");
    
    focus.svg.append("path")
//                .attr("d", function(d) { return focus.area(d); })
        .attr('class', 'column_hover')
        .style('display', 'none')
        .style('fill', 'black')
        .style('stroke', 'black')
        .style('fill-opacity', '0.2')
        .style('stroke-opacity', '0.6');
    
    buildInterface();
}

function loadDataFile(collection, subset, callback) {
//    var filename = "capture_stats/" + collection + '_' + subset + ".json";
    var url = "scripts/php/getEventTweetCounts.php";
    url += "?event_id=" + collection.ID;
    
    if(!options.time_limit.is('all')) {
        var time_limit = new Date(getCurrentCollection().StartTime);
        
        // Roll Back UTC (this is NOT the right way to do this)
//        time_limit.setHours(time_limit.getHours() - 8);
        
        if(options.time_limit.is('3h')) {
            time_limit.setHours(time_limit.getHours() + 3);
        } else if(options.time_limit.is('12h')) {
            time_limit.setHours(time_limit.getHours() + 12);
        } else if(options.time_limit.is('1d')) {
            time_limit.setDate(time_limit.getDate() + 1);
        } else if(options.time_limit.is('3d')) {
            time_limit.setDate(time_limit.getDate() + 3);
        } else if(options.time_limit.is('1w')) {
            time_limit.setDate(time_limit.getDate() + 7);
        }
        
        url += '&time_limit="' + formatDate(time_limit) + '"';
    } 

    d3.csv(url, function(error, data_file) {
        if (error) {
            alert("Sorry! File not found");
            return;
        }

        // Get the timestamps
        timestamps = Array.from(new Set(data_file.map(function(d) {return d.Time}))).sort();
        keywords = Array.from(new Set(data_file.map(function(d) {return d.Keyword})));
        keywords.pop(); // remove _total_, hopefully
        
        // Fill in missing timestamps
        var first_timestamp = timestamps[0];
        var last_timestamp = timestamps[timestamps.length - 1];
        
        var new_timestamps = [];
        
        for(var timestamp = new Date(first_timestamp);
            timestamp <= new Date(last_timestamp);
            timestamp.setMinutes(timestamp.getMinutes() + 1)) {
            new_timestamps.push(formatDate(timestamp));
        }
        timestamps = new_timestamps;
        
        var data_raw0 = {};
        // Create matrix to hold values
        options.subset.ids.map(function(subset) {
            data_raw0[subset] = {};
            data_raw[subset] = {};
            timestamps.map(function (timestamp) {
                var entry = {
                    timestamp: new Date(timestamp),
                    "_total_": 0
                };
                keywords.map(function(keyword) {
                    entry[keyword] = 0;
                });
                
                data_raw0[subset][timestamp] = entry;
            });
        });
        
        // Input values from the loaded file
        for(row in data_file) {
            var timestamp = data_file[row]['Time'];
            var keyword = data_file[row]['Keyword'];
            
            if(typeof data_file[row] !== 'object')
                continue;
            
            data_raw0['all'][timestamp][keyword] = parseInt(data_file[row]['Count']);
            data_raw0['distinct'][timestamp][keyword] = parseInt(data_file[row]['Distinct']);
            data_raw0['original'][timestamp][keyword] = parseInt(data_file[row]['Original']);
            data_raw0['retweet'][timestamp][keyword] = parseInt(data_file[row]['Retweet']);
            data_raw0['reply'][timestamp][keyword] = parseInt(data_file[row]['Reply']);
        }
        
        options.subset.ids.map(function(subset) {
            data_raw[subset] = [];
            for(row in data_raw0[subset]) {
                data_raw[subset].push(data_raw0[subset][row]);
            }
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
}

function getCurrentCollection () {
    var collection_name = options.collection.getLabel();
    
    return collections.reduce(function(collection, candidate) {
        if(collection.Name == collection_name)
            return collection;
        return candidate
    }, {});
}
    
function loadCollectionData() {
    toggleLoading(true);
    
    var collection = getCurrentCollection();
    if($.isEmptyObject(collection)) {
        toggleLoading(false);
        return;
    }
    
    data_raw = {};
    var subset_to_start = 'all'; //options.subset.get();
    
    // Load the collection's primary file
    loadDataFile(collection, subset_to_start, function() {
        
        // Get the keywords
//        keywords = d3.keys(data_raw[subset_to_start][0]).filter(function (key) {
//            return key !== "timestamp" && key !== '_total_';
//        });
        
        // Set Time Domain and Axis
        var x_min = data_raw[subset_to_start][0].timestamp;
        var x_max = data_raw[subset_to_start][data_raw[subset_to_start].length - 1].timestamp;
        focus.x.domain([x_min, x_max]).clamp(true);
        context.x.domain([x_min, x_max]);

        // Clear brush
        brush.clear();
        plot_area.svg.selectAll('.brush').call(brush);
        
//        // Load the rest of the data (asychronous) // no unnecessary
//        options.subset.ids.map(function(subset) {
//            loadDataFile(collection.Name, subset, function() {});
//        });
        
        changeSeries(subset_to_start);
    });
}

function loadNewSeriesData(subset) {
    series_data = series_names.map(function(name, i) {
        return {
            name: name,
            id: simplify(name),
            order: (i + 1) * 100,
            shown: true
        };
    });
    
    if(options.series.is('terms')) {
        collection = getCurrentCollection();

        series_data.map(function(datum) {
            datum.isKeyword = collection.Keywords.reduce(function(prev, keyword) {
                return prev |= keyword.toLowerCase() == datum.name.toLowerCase();
            }, false);
            datum.isOldKeyword = collection.OldKeywords.reduce(function(prev, keyword) {
                return prev |= keyword.toLowerCase() == datum.name.toLowerCase();
            }, false);
            
            datum.sum = data_raw['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                return cur_sum + datapoint[datum.name];
            }, 0);
        });
    } else if(options.series.is('types')) {
        series_data.map(function(datum) {
            if(datum.name == 'quote')
                datum.sum = data_raw['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint['_total_'];
                }, 0);
            else
                datum.sum = data_raw[datum.name].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint['_total_'];
                }, 0);
        });
        
        // Subtract the first three sums from the all sum to make the quote sum, presuming repeat is in the fourth place
        series_data[3].sum -= series_data[0].sum + series_data[1].sum + series_data[2].sum;
    } else if(options.series.is('distinct')) {
        series_data.map(function(datum) {
            if(datum.name == 'distinct')
                datum.sum = data_raw['distinct'].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint['_total_'];
                }, 0);
            else
                datum.sum = data_raw['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                    return cur_sum + datapoint['_total_'];
                }, 0);
        });
        
        // Subtract the distinct sum from the all sum to make the repeat sum, presuming repeat is in the second place
        series_data[1].sum -= series_data[0].sum;
    } else { // implicit none
        series_data.map(function(datum) {
            datum.sum = data_raw['all'].reduce(function(cur_sum, datapoint) { // Can change subset
                return cur_sum + datapoint['_total_'];
            }, 0);
        });
    }
}

function changeSeries(subset) {
    // Determine the series on the chart
    if(options.series.is('terms')) {
        series_names = keywords;
    } else if(options.series.is('types')) {
        series_names = ['original', 'retweet', 'reply', 'quote'];
    } else if(options.series.is('distinct')) {
        series_names = ['distinct', 'repeat'];
    } else {
        series_names = ['all'];
    }
    
    // Load the main series
    loadNewSeriesData(subset);

    // Build Legend    
    legend.populate(series_data);

    // Finish preparing the data for loading
    prepareData();   
}

function changeData() {
    loadNewSeriesData(options.subset.get());
    
    prepareData();
}

function prepareData() {
    // If we haven't loaded the data yet, tell the user and ask them to wait
    if(data_raw[options.subset.get()] == undefined) {
        // Wait a second, then if it still isn't ready, message user that they are waiting
        window.setTimeout(function() {
            if(data_raw[options.subset.get()] == undefined) {
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
                prepareData();
            }
        }, 1000);
        return;
    }
    
    // Aggregate on time depending on the resolution
    var data_nested_entries;
    if(options.series.is('types')) {
        data_nested_entries = []; // think about it
        for(var i = 0; i < data_raw['all'].length; i++) {
            entry = {
                timestamp: data_raw['all'][i]['timestamp'],
                _total_: data_raw['all'][i]['_total_'],
                original: data_raw['original'][i]['_total_'],
                retweet: data_raw['retweet'][i]['_total_'],
                reply: data_raw['reply'][i]['_total_']
            }
            entry.quote = entry['_total_'] - entry['original'] 
                        - entry['retweet'] - entry['reply'];
            data_nested_entries.push(entry);
        }
    } else if(options.series.is('distinct')) {
        data_nested_entries = []; // think about it
        for(var i = 0; i < data_raw['all'].length; i++) {
            entry = {
                timestamp: data_raw['all'][i]['timestamp'],
                _total_: data_raw['all'][i]['_total_'],
                distinct: data_raw['distinct'][i]['_total_'],
                repeat: data_raw['all'][i]['_total_'] - data_raw['distinct'][i]['_total_'],
            }
            data_nested_entries.push(entry);
        }
    } else {
        data_nested_entries = data_raw[options.subset.get()];
    }
                
    var data_nested = d3.nest()
        .key(function (d) {
            time = new Date(d.timestamp);
            if(options.resolution.is('tenminute'))
                time.setMinutes(Math.floor(time.getMinutes() / 10) * 10);
            if(options.resolution.is('hour') || options.resolution.is("day"))
                time.setMinutes(0);
            if(options.resolution.is("day"))
                time.setHours(0);
            return time;
        })
        .rollup(function (leaves) {
            newdata = {timestamp: leaves[0].timestamp};
            newdata['_total_'] = leaves.reduce(function(sum, cur) {
                return sum + cur['_total_'];
            }, 0);
            
            if(options.series.is('none')) {
                newdata['all'] = leaves.reduce(function(sum, leaf) {
                    return sum + leaf['_total_'];
                }, 0);
            } else {
                series_data.map(function(series) {
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
    
    total_byTime = data_ready.map(function(datum) {
        return Math.max(series_names.reduce(function(running_sum, word) {
            return running_sum += datum[word];
        }, 0), 1);
    });
    context_byTime = data_ready.map(function(datum) {
        return {timestamp: datum.timestamp, value: datum['_total_']};
    });
    
    // Reorder by total size
    series_data.sort(compareSeries);
    legend.container_series.selectAll('div.legend_entry').sort(compareSeries);
    setColors();
    
    // Add the nested data to the series
    series_data.map(function(datum) {
        datum.values = data_ready.map(function(d) {
            return {timestamp: d.timestamp, value: d[datum.name]};
        });
        datum.max = data_ready.reduce(function(cur_max, d) {
            return Math.max(cur_max, d[datum.name]);
        }, 0);
    });
    
    // Set Time Domain and Axis appropriate to the resolution
    setContextTime(data_ready[0].timestamp, data_ready[data_ready.length - 1].timestamp);
    
    // Display the xAxis
    var ax = focus.svg.select("g#xAxis");
    if(!ax[0][0])
        ax = focus.svg.append('g').attr('id', 'xAxis');
    ax.attr('class','x axis')
        .attr('transform', 'translate(0,' + focus.height + ')')
        .transition().duration(1000)
        .call(focus.xAxis);
    
    // Set the Y-Axis label
    focus.svg.select('#y_label')
        .text("Count of " + options.subset.getLabel() + " Tweets"
              + " Every " + options.resolution.getLabel() + "");
    
    // Display values on the context chart
    context.y.domain([0, data_ready.reduce(function (cur_max, series) {
            return Math.max(cur_max, series["_total_"]);
        }, 0)])
            .range([context.height, 0]);
    
    context.area
        .interpolate(options.shape.get());
    
    context.svg.selectAll(".x, .area").remove();
    context.svg.append("path")
        .datum(data_ready)
        .attr("class", "area")
        .attr("d", context.area);

    context.svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + context.height + ")")
        .call(context.xAxis);

    context.svg.append("g")
        .attr("class", "x brush")
        .call(brush)
        .selectAll("rect")
        .attr("y", -6)
        .attr("height", context.height + 7);
    
    // Display the data
    display();
}

function display() {
    setYScale();
    
    if (options.display_type.is("wiggle")) {
        stack.offset("wiggle");
    } else if (options.display_type.is("stream_expand")) {
        stack.offset("expand");
    } else if (options.display_type.is("stream")) {
        stack.offset("silhouette");
    } else {
        stack.offset("zero");
    }

    // Set stack representation of data
    if(options.display_type.is("percent")) {
        data_100 = series_data.map(function(series) {
            var new_series = JSON.parse(JSON.stringify(series));
            new_series.values = new_series.values.map(function(datum, i) {
                var new_datum = datum;
                new_datum.timestamp = new Date(new_datum.timestamp);
                new_datum.value *= 100 / total_byTime[i];
                return new_datum;
            });
            return new_series;            
        });
        data_stacked = stack(data_100);
    } else {
        data_stacked = stack(series_data);
    }
    
    // Change data for display
    n_series = data_stacked.length;
    if(n_series == 0) {
        toggleLoading(false);
        alert('No data');
        return;
    }
    n_datapoints = data_stacked[0].values.length;
    if(options.display_type.is("separate")) {
        for (var i = n_series - 1; i >= 0; i--) {
            data_stacked[i].offset = 0;
            if(i < n_series - 1) {
                data_stacked[i].offset = data_stacked[i + 1].offset;
                if(series_data[i + 1].shown)
                    data_stacked[i].offset += data_stacked[i + 1].max;
            }
            
            data_stacked[i].values.map(function(datum) {
                datum.value0 = data_stacked[i].offset;
            });
        }
    } 
    
    // I want the starting chart to emanate from the
    // middle of the display.
    focus.area
        .interpolate(options.shape.get())
        .y0(focus.height / 2)
        .y1(focus.height / 2);
    
    // Set the Y Domain
    var y_min = 0;
    if(options.y_scale.is("log"))
        y_min = 1;
    
    var y_max = 100;
    var biggest_datapoint = // data is defined by its own maxes
        d3.max(data_stacked.map(function (d) {
            return d.max;
        }));
    var highest_datapoint = // because of stacked data
        d3.max(data_stacked[0].values.map(function (d) {
            return d.value0 + d.value;
        }));
    var biggest_totalpoint = 
        d3.max(context_byTime.map(function (d) {
            return d.value;
        }));
    
    if(options.y_max_toggle.get() == "true") {
        y_max = options.y_max.get();
    } else {
        if (options.display_type.is('overlap') | options.display_type.is('lines')) {
            y_max = biggest_datapoint;
            
            if(options.context_line.is("true"))
                y_max = Math.max(y_max, biggest_totalpoint);
        } else if (options.display_type.is('percent')) {
            y_max = 100;
        } else {
            y_max = highest_datapoint;
            if(options.context_line.is("true"))
                y_max = Math.max(y_max, biggest_totalpoint);
        }
        options.y_max.update(y_max);
        options.y_max.set(y_max);
    }
    
    focus.y.domain([y_min, y_max])
        .range([focus.height, 0]);
    focus.y_context.domain([y_min, y_max])
        .range([focus.height, 0]);
    
    if(options.y_scale.is("log")) {
        focus.yAxis.scale(focus.y)
            .tickFormat(focus.y.tickFormat(10, ",.0f"));
    }

    // Create y Axises
    ax = focus.svg.select("g#yAxis");
    if(!ax[0][0])
        ax = focus.svg.append('g').attr('id', 'yAxis');
    ax.attr("class", "y axis")
        .transition().duration(1000)
        .call(focus.yAxis);
    
    ax = context.svg.select("g#context_yAxis");
    if(!ax[0][0])
        ax = context.svg.append('g').attr('id', 'context_yAxis');
    ax.attr("class", "context_y axis")
        .call(context.yAxis);
    
    display_context_line();

    // Bind new series to the graph
    
    var series = focus.svg.selectAll(".series")
        .data(data_stacked);
 
    var series_paths = series.enter().append("g")
//        .on("mouseover", legend.highlightSeries)
        .on("mouseout", legend.unHighlightSeries)
        .on("click", function(d) {
            var xy = d3.mouse(this);
            var time = focus.x.invert(xy[0]);
            var coeff = 1000 * 60; // get a minute on other side
            if(options.resolution.is('tenminute')) {
                coeff *= 10;
            } else if(options.resolution.is('hour')) {
                coeff *= 60;
            } else if(options.resolution.is('day')) {
                coeff *= 60 * 24;
            }
            var startTime = new Date(Math.round(time.getTime() / coeff) * coeff)
            var stopTime = new Date(startTime.getTime() + coeff)
            
            getTweets(d, startTime, stopTime);
        })
        .on("mouseover", legend.highlightSeries)
        .on("mouseout", function(d) {
            focus.svg.select('path.column_hover')
                .style('display', 'none');
            
            legend.unHighlightSeries(d)
        })
        .on("mousemove", function(d) {
            var xy = d3.mouse(this);
            var time = focus.x.invert(xy[0]);
            var coeff = 1000 * 60; // get a minute on other side
            if(options.resolution.is('tenminute')) {
                coeff *= 10;
            } else if(options.resolution.is('hour')) {
                coeff *= 60;
            } else if(options.resolution.is('day')) {
                coeff *= 60 * 24;
            }
            var startTime = new Date(Math.floor(time.getTime() / coeff) * coeff)
            var stopTime = new Date(startTime.getTime() + coeff)
            
            var focus_column = focus.svg.select('path.column_hover');
            var old_data = focus_column.data();
            
//            var value_i = Math.floor(xy[0] / focus.width * d.values.length);
            var value_i = timestamps_nested.indexOf(startTime + "") + 1;
            var value = d.values[value_i].value;
            var value0 = d.values[value_i].value0;
            
            if(!old_data || old_data.series != d.id ||
               old_data.startTime != startTime || old_data.stopTime != stopTime) {
                
                focus_column.data([{
                    series: d.id,
                    startTime: startTime,
                    stopTime: stopTime,
                    value: value,
                    value0: value0
                }]);

                focus_column
                    .transition()
                    .duration(50)
                    .attr("d", 
                        focus.area([
                            {timestamp: startTime, value: value, value0: value0},
                            {timestamp: stopTime, value: value, value0: value0}
                        ]))
                    .style('display', 'block');
            }
            
            if(!old_data || old_data.series != d.id)
                legend.highlightSeries(d);
        });
    
    series.attr("class", function(d) {
            return "series " + d.id
        });
    
    series.exit().remove();
 
    series_paths.append("path")
        .attr("class", "area");
//        .style("stroke-opacity", 0)
//        .attr("d", function (d) { return focus.area(d.values); });
    
    // Define the parameters of the area
    if (options.display_type.is('overlap') | options.display_type.is('lines')) {
        focus.area
            .y0(focus.height)
            .y1(function (d) { return focus.y(d.value); });
    } else {
        focus.area
            .y0(function (d) { return focus.y(d.value0); })
            .y1(function (d) { return focus.y(d.value0 + d.value); });
    }
    
    // here we create the transition
    transition = focus.svg.selectAll(".series")
        .transition()
        .duration(750)
    
    // Transition to the new area
    var fill_opacity = options.display_type.is("lines") ? 0.0 : 
                    (options.display_type.is("overlap") ? 0.1 : 0.8);
    
    focus.svg.selectAll(".series")
        .classed("lines", false);
    transition.select("path.area")
        .style("fill", function (d) { return color(d.name); })
        .style("fill-opacity", fill_opacity)
        .style("stroke", function (d) { return d3.rgb(color(d.name)).darker(); })
//        .style("stroke-opacity", 1.0)
        .attr("d", function(d) { return focus.area(d.values)});
            
    toggleLoading(false);
}

function setContextTime(time_min, time_max) {
    // Establish the maximum and minimum time of the data series
    var startTime = options.time_min.get();
    var endTime =   options.time_max.get();
    
    if(startTime.getTime() == endTime.getTime() || options.time_save.get() == "false") {
        startTime = time_min;
        endTime = time_max;
    } else {
        if(startTime < time_min || startTime > time_max)
            startTime = time_min;
        if(endTime < time_min || endTime > time_max)
            endTime = time_max;
    }
    
    // Set the context and focus domains
    context.x.domain([time_min, time_max]);
    focus.x.domain(brush.empty() ? [startTime, endTime] : brush.extent());
    
    // Initialize the brush if it isn't identical
    if(startTime > time_min || endTime < time_max) {
        brush.extent([startTime, endTime]);
    }
    
    // Set the time option
    options.time_min.set(startTime);
    options.time_min.min = new Date(time_min);
    options.time_max.set(endTime);
    options.time_max.max = new Date(time_max);
    
    // Set the manual field constraints
    var startDateTextBox = $('#choose_time_min');
    startDateTextBox.datetimepicker('option', 'minDate', time_min);
    startDateTextBox.datetimepicker('option', 'maxDate', endTime);
    startDateTextBox.datetimepicker("setDate", startTime);
    
    var endDateTextBox = $('#choose_time_max');
    endDateTextBox.datetimepicker('option', 'minDate', startTime);
    endDateTextBox.datetimepicker('option', 'maxDate', time_max);
    endDateTextBox.datetimepicker("setDate", endTime);
}

function setFocusTime(origin) {
    var startDateTextBox = $('#choose_time_min');
    var endDateTextBox = $('#choose_time_max');
    var startTime, endTime;
    var brushEvent = false;
    
    // Get time from the originator of this request
    if(origin == "brush") {
        var times = brush.extent();
        startTime = times[0];
        endTime   = times[1];
        
        brushEvent = true;
    } else if(origin == "input_field") {
        startTime = startDateTextBox.datetimepicker('getDate');
        endTime   =   endDateTextBox.datetimepicker('getDate');
    } else if(origin == "button_time_to_start") { // The min and max possible?
        startTime = new Date(options.time_min.min);
    } else if(origin == "button_time_minus_6h") { // The min and max possible?
        startTime = options.time_min.get();
        startTime.setHours(startTime.getHours() - 6);
    } else if(origin == "button_time_minus_1h") { // The min and max possible?
        startTime = options.time_min.get();
        startTime.setHours(startTime.getHours() - 1);
    } else if(origin == "button_time_to_end") { // The min and max possible?
        endTime   = new Date(options.time_max.max);
    } else if(origin == "button_time_plus_1h") { // The min and max possible?
        startTime = options.time_min.get();
        startTime.setHours(startTime.getHours() + 1);
    } else if(origin == "button_time_plus_6h") { // The min and max possible?
        startTime = options.time_min.get();
        startTime.setHours(startTime.getHours() + 6);
    }
    
    if(!startTime)
        startTime = options.time_min.get();
    if(!endTime)
        endTime   = options.time_max.get();
    
    // Bound the start and end times
    if(startTime < options.time_min.min)
        startTime = new Date(options.time_min.min);
    if(endTime > options.time_max.max)
        endTime = new Date(options.time_max.max);
    if(startTime >= endTime ) {
        startTime = new Date(options.time_min.min);
        endTime = new Date(options.time_max.max);
    }
    
    startDateTextBox.datetimepicker("setDate", startTime);
      endDateTextBox.datetimepicker("setDate", endTime);
    
    options.time_min.set(startTime);
    options.time_max.set(endTime);

    if(startTime > options.time_min.min || endTime < options.time_max.max) {    
        if(!brushEvent) {
            // Update the brush
            brush.extent([startTime, endTime])
            brush(d3.select(".brush").transition());
            brush.event(d3.select(".brush").transition())
        }
    } else {
        d3.selectAll(".brush").call(brush.clear());//brush.clear();
    }
    
    options.recordState(options, 'time_min');
    options.recordState(options, 'time_max');
    
    focus.x.domain(brush.empty() ? context.x.domain() : brush.extent());
    focus.svg.selectAll("path.area")
        .attr("d", function(d) { return focus.area(d.values)});
    focus.svg.selectAll("path.area_context")
        .attr("d", function(d) { return focus.area_context(d)});
    focus.svg.select(".x.axis")
        .call(focus.xAxis);
}

function toggleLoading(toggle) {
    if(toggle) {
        $('#timeseries_div').append(spin.spin().el);
        d3.select('#charts')
            .style("opacity", 0.5);
    } else {
        spin.stop();
        d3.select('#charts')
            .style("opacity", 1);
    }
}

function buildInterface() {
    toggleLoading(true);
    
    // Collection selection
    d3.json("scripts/php/getCollections.php", function(error, collections_file) {
        if (error) throw error;
        
        // Add collections
        collections_file.sort(compareCollections);
        collections_file.reverse();
        collections = collections_file;
        
        // Get new data
        collection_names = collections.map(function(collection) {
            return collection.Name;
        });
        collections.map(function(collection) {
            collection.Keywords = collection.Keywords.trim().split(/,[ ]*/);
            collection.OldKeywords = collection.OldKeywords.trim().split(/,[ ]*/);
            if(collection.OldKeywords.length == 1 && collection.OldKeywords[0] == "")
                collection.OldKeywords = [];
            collection.StartTime = new Date(collection.StartTime);
            collection.StartTime.setMinutes(collection.StartTime.getMinutes()
                                           -collection.StartTime.getTimezoneOffset());
            if(collection.StopTime)
                collection.StopTime = new Date(collection.StopTime);
            else
                collection.StopTime = "Ongoing";
        });
        
        // Generate options, including collections
        options.collection.labels = collection_names;
        options.collection.ids = collection_names.map(function(name) { return simplify(name); } );
        options.collection.available = collection_names.map(function(d, i) { return i; });
        options.collection.set(collection_names[0]);
        
        options.init();
        
        // Add additional information for collections
        collection_names.map(function(name, i) {
            var content = '<dl class="dl-horizontal collection_popover">';
            var collection = collections[i];
            Object.keys(collection).map(function(key) {
                content += "<dt>" + key + "</dt>";
                
                if(collection[key] instanceof Date) {
                    var date = new Date(collection[key]);
                    content += "<dd>" + formatDate(date) + "</dd>";
                } else if(collection[key] instanceof Array) {
                    var arr = collection[key].join(", ");
                    content += "<dd>" + arr + "</dd>";
                } else {
                    content += "<dd>" + collection[key] + "</dd>";
                }
            });
            content += "</dl>";
            
            d3.select('#collection_' + simplify(name))
                .attr({
                    'class': 'collection_option',
                    'data-toggle': "popover",
                    'data-trigger': "hover",
                    'data-placement': "right",
                    'data-content': content}
                 );
        });
        $('.collection_option').popover({html: true});
        
        // Initialize Legend
        legend = new Legend();
        legend.init();
        
        loadCollectionData();
    });
}

function genEventTweetCount() {
    var event_id = getCurrentCollection().ID;
    var search_term = options.add_term.get().toLowerCase();
    // Generate PHP query
    var url = "scripts/php/genEventTweetCounts.php";
    url += "?event_id=" + event_id;
    url += '&time_min="' + formatDate(options.time_min.min) + '"';
    url += '&time_max="' + formatDate(options.time_max.max) + '"';
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
        .domain(context.x.domain());
    
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

    d3.text(url, function(error, data) {
        console.debug(error);
        console.info(data);
        if(error || data.substring(0, 7) != "REPLACE") {
            alert("Problem generating new series");
        }
        
        d3.select('#new_keyword_progress_div').remove();
//        clearInterval(check);
        loadCollectionData();
    });
}

function getTweets(series, startTime, stopTime) {
    var url = "scripts/php/getTweets.php";
    url += "?event_id=" + getCurrentCollection().ID;
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
    url += '&time_min="' + formatDate(startTime) + '"';
    title += " between <br />" + formatDate(startTime);
    
//    stopTime.setHours(stopTime.getHours() - 8); // temporary UTC/PST fix
    url += '&time_max="' + formatDate(stopTime) + '"';
    title += " and " + formatDate(stopTime);
    
    console.info(url);
    d3.text(url, function(error, data) {
        
        d3.select('#selectedTweetsModal .modal-title')
            .html(title);
        
        var modal_body = d3.select('#selectedTweetsModal .modal-body');
        modal_body.selectAll('*').remove();
        
        
        if(data.indexOf('Maximum execution time') >= 0) {
            modal_body.append('div')
                .attr('class', 'text-center')
                .html("Error retrieving tweets. <br /><br /> Query took too long");
        } else if (data.indexOf('Fatal error') >= 0 || data.indexOf('Errormessage') >= 0) {
            modal_body.append('div')
                .attr('class', 'text-center')
                .html("Error retrieving tweets. <br /><br /> " + data);
        } else if (error) {
            modal_body.append('div')
                .attr('class', 'text-center')
                .html("Error retrieving tweets. <br /><br /> " + error);
        } else {
            data = JSON.parse(data);
            
            if(data.length == 0) {
                modal_body.append('div')
                    .attr('class', 'text-center')
                    .text("No tweets found in this selection.");
            } else {
                modal_body.append('ul')
                    .attr('class', 'list-group')
                    .selectAll('li').data(data).enter()
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

function setColors() {
    setColorScale();
    
    // Set color values
    color.domain(series_data.map(function(series) {return series.name;}));
    
    series_data.map(function(series) {
        series.fill = color(series.name);
        series.stroke = d3.rgb(color(series.name)).darker();
        
        d3.select("." + series.id + " .legend_icon")
            .style('fill', series.fill)
            .style('stroke', series.stroke);
    });
}

function compareCollections(a, b) {
    if(a.StartTime < b.StartTime) 
        return -1;
    if(a.StartTime > b.StartTime)
        return 1;
    return 0;
}
function compareSeries(a, b) {
    if(a.sum !== undefined && b.sum !== undefined)
        return b.sum - a.sum;
    return a.order - b.order;
}

function display_context_line() {    
    // Find or create context line
    var container = focus.svg.select("g#y_context");
    if(!container[0][0]) {
        container = focus.svg.append('g')
            .attr('id', 'y_context');
        container.append('path')
            .attr('class', 'area_context context_line')
    }
    
    // Update Data
    container.data([context_byTime]);
    
    transition = container
        .transition()
        .duration(750);
    
    var multiplier = 1;
    if(options.display_type.is('percent')) {
        var biggest_totalpoint = context_byTime.reduce(function (cur_max, d) {
            return Math.max(cur_max, d.value);
        }, 0);
        multiplier = 100 / biggest_totalpoint;
    }
        
    focus.area_context
        .interpolate(options.shape.get())
        .y0(focus.height)
        .y1(function (d) { return focus.y_context(d.value * multiplier); });
    
    if(options.context_line.is("false"))
        focus.area_context.y1(focus.height);
    
    transition.select("path.area_context")
        .attr("d", function(d) { return focus.area_context(d)});
    
    // Set visibility
    legend.key.select('.legend_key_context_line')
        .classed('hidden', options.context_line.is("false"));
//    container.style('display', options.context_line.is("true") ? 'block' : 'none');
}

function setYScale() {
    if(options.y_scale.is("linear")) {
        focus.y = d3.scale.linear()
            .range([focus.height, 0]);
        focus.y_context = d3.scale.linear()
            .range([focus.height, 0]);
        focus.yAxis.scale(focus.y)
            .tickFormat(null);
    } else if(options.y_scale.is("pow")) {
        focus.y = d3.scale.sqrt()
            .range([focus.height, 0]);
        focus.y_context = d3.scale.sqrt()
            .range([focus.height, 0]);
        focus.yAxis.scale(focus.y)
            .tickFormat(null);
    } else if(options.y_scale.is("log")) {
        focus.y = d3.scale.log()
            .clamp(true)
            .range([focus.height, 0]);
        focus.y_context = d3.scale.log()
            .clamp(true)
            .range([focus.height, 0]);
        focus.yAxis.scale(focus.y)
            .tickFormat(focus.y.tickFormat(10, ",.0f"));
    }
}

function setColorScale() {
    switch(options.color_scale.get()) {
        case "category10":
            color = d3.scale.category10();
            break;
        case "category20":
            color = d3.scale.category20();
            break;
        case "category20b":
            color = d3.scale.category20b();
            break;
        case "category20c":
            color = d3.scale.category20c();
            break;
        default:
            color = d3.scale.category10();
            break;
    }
}

function simplify(str) {
    return "l" + str.replace(/[\s\.#]+/g, '_');
}
    
function URLExists (url) {
    var http = $.ajax({
        type: 'HEAD',
        url: url,
        async: false,
        success: function () {},
        error: function () {}
    });
    return http.status != 404;
}