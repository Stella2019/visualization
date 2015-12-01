Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

var collections;
var collection_names = ["Paris Shooting", "Paris Collection 2", "Paris Shooting - 3 - New Terms", "SahafiHotelAttack", "Sinai Plane Crash", "NORAD blimp on the loose", "Earthquake in Pakistan and Afghanistan", "Hurricane Patricia - Spanish terms", "Flooding from Patricia", "Hurricane Patricia", "Wilfrid Laurier Lockdown", "Black Lives Matter Collection", "Ankara Bombing", "Hurricane Oho", "Doctors without Borders", "Townhall gunmen", "umpqua college shooting", "Hurricane Joaquin - hurricane terms", "Hurricane Joaquin - flooding terms", "Yemen mosque bombing", "Chile", "Flash Flood", "California Valley Fire", "Grand Mosque accident", "Refugee crisis", "Karachi Explosion", "Chicago Shooting", "Western WA storms", "Tropical Storm Erika", "WA Wildfires - August", "Cotopaxi volcano", "FAA outage", "Chemical Spill - August 2015", "Alaska Earthquake - July 26", "Navy Shooting", "NYSE Stock Exchange Cant Exchange", "India Earthquake"];
var data_stacked, series_data, data_raw, total_byTime;
var keywords, keywords_selected;
var options = new Options();

window.onload = initialize;

var parseDate, formatPercent,
    color,
    area, stack,
    brush, drag;
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

    parseDate = d3.time.format("%Y%m%d_%H%M").parse;
    formatPercent = d3.format(".0%");

    focus.x = d3.time.scale()
        .range([0, focus.width]);
    context.x = d3.time.scale()
        .range([0, context.width]);

    focus.y = d3.scale.linear()
        .range([focus.height, 0]);
    context.y = d3.scale.linear()
        .range([context.height, 0]);

    color = d3.scale.category10();

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
    
    context.yAxis = d3.svg.axis()
        .scale(context.y)
        .ticks(2)
        .orient("left");

    brush = d3.svg.brush()
        .x(context.x)
        .on("brush", brushed);
    
    drag = d3.behavior.drag();
    
    focus.area = d3.svg.area()
        .interpolate(options.shape.get())
        .x(function (d) { return focus.x(d.timestamp); });

    context.area = d3.svg.area()
        .interpolate(options.shape.get())
        .x(function(d) { return context.x(d.timestamp); })
        .y0(context.height)
        .y1(function(d) { return context.y(d.tweets); });
    
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
    
    buildInterface();
}

function loadDataFile(collection, subset, callback) {
    var filename = "capture_stats/" + collection + (subset != 'all' ? '_' + subset : '') + ".json";
    
    d3.json(filename, function(error, data_file) {
        if (error) throw error;

        // Get the timestamps
        timestamps = Object.keys(data_file).sort();

        // Get the keywords
        var keywords = d3.keys(data_file[timestamps[0]]).filter(function (key) {
            return key !== "timestamp" && key !== 'tweets';
        });

        // Parse dates and ints
        data_raw[subset] = [];
        for (var i = 0; i < timestamps.length; i++) {
            timestamp = timestamps[i];
            entry = {
                timestamp: parseDate(timestamp),
                tweets: data_file[timestamp]["tweets"]
            };
            keywords.map(function(keyword) {
                entry[keyword] = parseInt(data_file[timestamp][keyword]);
            });
            data_raw[subset].push(entry);
        }
        
        d3.selectAll("#choose_subset #" + subset)
            .attr("disabled", null);
        
        callback();
    });
}
    
function loadCollectionData() {
    var selectedIndex = d3.select("select#chooseCollection").property('selectedIndex');
    var collection = collection_names[selectedIndex];
    
    // Turn off all subsets
    d3.selectAll("#choose_subset button")
            .attr("disabled", "");
    
    data_raw = {};
    var subset_to_start = options.subset.get();
    
    // Load the collection's primary file
    loadDataFile(collection, subset_to_start, function() {
        
        // Get the keywords
        keywords = d3.keys(data_raw[subset_to_start][0]).filter(function (key) {
            return key !== "timestamp" && key !== 'tweets';
        });
        
        // Set Time Domain and Axis
        var x_min = data_raw[subset_to_start][0].timestamp;
        var x_max = data_raw[subset_to_start][data_raw[subset_to_start].length - 1].timestamp;
        focus.x.domain([x_min, x_max]).clamp(true);
        context.x.domain([x_min, x_max]);

        // Clear brush
        brush.clear();
        plot_area.svg.selectAll('.brush').call(brush);
        
        // Load the rest of the data (asychronous)
        options.subset.ids.map(function(subset) {
            loadDataFile(collection, subset, function() {});
        });
        
        // Load the main series
        loadNewSeriesData(subset_to_start);
        
        // Build Legend
        keywords_selected = {};
        keywords.forEach(function(name, i) {
            keywords_selected[name] = true; 
        });
        buildLegend();
        
        // Finish preparing the data for loading
        prepareData();
    });
}

function loadNewSeriesData(subset) {
    series_data = [];
    keywords.forEach(function(name, i) {
        series_data.push({
            name: name,
            id: simplify(name),
            order: (i + 1) * 100,
            shown: true, // replaced the map keywords_selected with this at some point
            sum: data_raw[subset].reduce(function(cur_sum, datapoint) {
                return cur_sum + datapoint[name];
            }, 0)
        });
    });
}

function changeData() {
    loadNewSeriesData(options.subset.get());
    
    prepareData();
}

function prepareData() {
    // Aggregate on time depending on the resolution
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
            newdata.tweets = leaves.reduce(function(sum, cur) {
                return sum + cur.tweets;
            }, 0);
            keywords.map(function(keyword) {
                if(keywords_selected[keyword]) {
                    newdata[keyword] = leaves.reduce(function(sum, leaf) {
                        return sum + leaf[keyword];
                    }, 0);
                } else {
                    newdata[keyword] = 0;
                }
            });

            return newdata;
        })
        .entries(data_raw[options.subset.get()]);

    // Convert data to a format the charts can use
    var data_ready = [];
    data_nested.map(function (d, i) {
        new_data = d.values;
        new_data.timestamp = new Date(d.key);
        data_ready.push(new_data);
    });
    
    total_byTime = data_ready.map(function(datum) {
        return Math.max(keywords.reduce(function(running_sum, word) {
            return running_sum += datum[word];
        }, 0), 1);
    });
    
    // Reorder by total size
    series_data.sort(compareSeries);
    legend.container_inactive.selectAll('div.legend_entry').sort(compareSeries);
    legend.container_active.selectAll('div.legend_entry').sort(compareSeries);
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
    var x_min = data_ready[0].timestamp;
    var x_max = data_ready[data_ready.length - 1].timestamp;
    context.x.domain([x_min, x_max]);
    focus.x.domain(brush.empty() ? context.x.domain() : brush.extent());
    
    // Display the xAxis
    var ax = focus.svg.select("g#xAxis");
    if(!ax[0][0])
        ax = focus.svg.append('g').attr('id', 'xAxis');
    ax.attr('class','x axis')
        .attr('transform', 'translate(0,' + focus.height + ')')
        .transition().duration(1000)
        .call(focus.xAxis);
    
    // Display values on the context chart
    context.y.domain([0, data_ready.reduce(function (cur_max, series) {
            return Math.max(cur_max, series["tweets"]);
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
    n_datapoints = data_stacked[0].values.length;
    if(options.display_type.is("separate")) {
        for (var i = n_series - 1; i >= 0; i--) {
            data_stacked[i].offset = 0;
            if(i < n_series - 1) {
                data_stacked[i].offset = data_stacked[i + 1].offset;
                if(keywords_selected[data_stacked[i + 1].name])
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
    if (options.display_type.is('lines')) {
        y_max = d3.max(data_stacked.map(function (d) {
            return d.max;
        }));
    } else if (options.display_type.is('percent')) {
        y_max = 100;
    } else {
        y_max = d3.max(data_stacked[0].values.map(function (d) {
            return d.value0 + d.value;
        }));
    }	
    focus.y.domain([y_min, y_max])
        .range([focus.height, 0]);
    
    if(options.y_scale.is("log")) { // Inform the yAxis
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

    // Bind new series to the graph
    
    var series = focus.svg.selectAll(".series")
        .data(data_stacked);
 
    var series_paths = series.enter().append("g")
        .on("mouseover", highlightKeyword)
        .on("mouseout", unHighlightKeyword);
    
    series.attr("class", function(d) {
            return "series " + d.id
        });
    
    series.exit().remove();
 
    series_paths.append("path")
        .attr("class", "area")
        .style("stroke-opacity", 0)
        .style("fill", function (d) { return color(d.name); })
        .style("stroke", function (d) { return color(d.name); })
        .attr("d", function (d) { return focus.area(d.values); });
    
    // Define the parameters of the area
    if (options.display_type.is('lines')) {
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
    if(options.display_type.is("lines")) {
        focus.svg.selectAll(".series")
            .classed("lines", true);
        transition.select("path.area")
            .style("fill-opacity", 0.1)
            .style("stroke-opacity", 1.0)
            .attr("d", function(d) { return focus.area(d.values)});
    } else {
        focus.svg.selectAll(".series")
            .classed("lines", false);
        transition.select("path.area")
            .style("fill-opacity", 1.0)
            .attr("d", function(d) { return focus.area(d.values)});
    }
}

function brushed() {
    focus.x.domain(brush.empty() ? context.x.domain() : brush.extent());
    focus.svg.selectAll("path.area")
        .attr("d", function(d) { return focus.area(d.values)});
    focus.svg.select(".x.axis")
        .call(focus.xAxis);
}

function buildInterface() {
    // Collection selection
    d3.json("capture_stats/collections.json", function(error, collections_file) {
        if (error) throw error;
        
        // Add collections
        collections_file.sort(compareCollections);
        collections_file.reverse();
        collections = collections_file;
        
        collection_names = collections.map(function(collection) {
            return collection.name;
        });
        
        select  = d3.select("select#chooseCollection").on('change', loadCollectionData);
        var select_collections = select.selectAll("option").data(collection_names);

        select_collections.enter().append("option").text(function (d) { return d; });
        
        // Add additional options
        options.init();
        d3.selectAll("#choose_y_scale button:not(#linear)")
            .attr("disabled", "");
        
        
        // Add legend with constituent parts
        legend = {};
        legend.container = d3.select('#legend');
        
        legend.container_active = legend.container.append('div')
            .data(['legend_active']);
        legend.container_inactive = legend.container.append('div')
            .data(['legend_inactive']);
        
        var legend_parts = legend.container.selectAll('div')
            .attr('id', function(d) { return d; })
            .attr('class', 'legend_part')
            .attr('droppable', "")
            .on('dragover', function(d) {
                    d3.event.preventDefault();
                    legend.dragover = d;
            })
        
        legend_parts.append('div')
            .attr('class', 'legend_title text-center')
            .style({'font-weight': 'bold', margin: '5px'})
            .text(function(d) {
                if(d == 'legend_active') return 'Series';
                if(d == 'legend_inactive') return 'Hidden Series';
            });
        legend_parts.append('div')
            .attr('class', 'legend_drag_tip text-center')
            .style({'font-style': 'italic', margin: '5px', color: '#ddd'})
            .style('display', 'none')
            .text(function(d) {
                if(d == 'legend_active') return 'Drag items to here to show';
                if(d == 'legend_inactive') return 'Drag items to here to hide';
            });
        
        loadCollectionData();
    });
}

function setColors() {
    // Set color values
    color.domain(series_data.map(function(entry) {return entry.name;}));
    
    legend.container.selectAll('div.legend_icon')
        .style('background-color', function (d) { return color(d.name); })
        .style('border-color', function (d) { return color(d.name); });
}

function buildLegend (flag_reset) {
    // Make the legend
    var legend_entries = legend.container_active
        .selectAll('div.legend_entry')
        .data(series_data);
    legend.container_inactive.selectAll('.legend_entry').remove();
    legend.container_inactive.select('.legend_drag_tip')
        .style('display', 'block');

    legend_entries.enter().append('div')
        .attr('id', function(d) {
            return 'legend_' + d.id;
        })
        .attr('class', function(d) {
            return 'legend_entry draggable ' + d.id;
        })
//        .on('click', chooseKeywords)
        .on('mouseover', highlightKeyword)
        .on('mouseout', unHighlightKeyword)
        .attr('draggable', true)
        .on('dragend', function(d) {
            document.getElementById(legend.dragover)
                .appendChild(this);
        
            // Set drag tooltip visibility if a category is empty (or now no longer)
            legend.container.selectAll('.legend_part').select('.legend_drag_tip')
                .style('display', function(legend_part) {
                    if(d3.select('#' + legend_part).selectAll('div.legend_entry')[0].length == 0)
                        return 'block';
                    else
                        return 'none';
                });
        
            // Set whether the keyword is active & change style
            keywords_selected[d.name] = legend.dragover == 'legend_active';
            legend.container.select('.' + d.id + ' .legend_icon')
                .classed('off', !keywords_selected[d.name]);
        
            legend.container_inactive.selectAll('div.legend_entry').sort(compareSeries);
            legend.container_active.selectAll('div.legend_entry').sort(compareSeries);

            // Refresh the graph
            prepareData();
        });
//        .call(drag);

    legend_entries.selectAll('div.legend_icon')
        .data(function(d) { return [d]; })
        .enter().append('div')
        .attr('class', 'legend_icon');

    legend_entries.selectAll('div.legend_label')
        .data(function(d) { return [d]; })
        .enter().append('div')
        .attr('class', 'legend_label');

//    legend_entries.selectAll('button.legend_button')
//        .data(function(d) { return [d]; })
//        .enter().append('button')
//        .style('width', '20px')
//        .on('click', function(d) {
//        
//        
//            document.getElementById(legend.dragover)
//                .appendChild(this);
//        
//            // Set drag tooltip visibility if a category is empty (or now no longer)
//            legend.container.selectAll('.legend_part').select('.legend_drag_tip')
//                .style('display', function(legend_part) {
//                    if(d3.select('#' + legend_part).selectAll('div.legend_entry')[0].length == 0)
//                        return 'block';
//                    else
//                        return 'none';
//                });
//        
//            // Set whether the keyword is active & change style
//            keywords_selected[d.name] = legend.dragover == 'legend_active';
//            legend.container.select('.' + d.id + ' .legend_icon')
//                .classed('off', !keywords_selected[d.name]);
//        
//            legend.container_inactive.selectAll('div.legend_entry').sort(compareSeries);
//            legend.container_active.selectAll('div.legend_entry').sort(compareSeries);
//
//            // Refresh the graph
//            prepareData();
//        });
    
    legend_entries.exit().remove();
    
    legend_entries
        .attr('class', function(d) {
            return 'legend_entry ' + d.id;
        });
    
    legend.container.selectAll('div.legend_icon')
        .classed('off', false);
    
    legend.container.selectAll('div.legend_label')
        .text(function (d) {
            return d.name;
        });
}

function highlightKeyword(keyword) {
    if((typeof keyword) != "string")
        keyword = keyword.name;
    
    d3.selectAll('.series, .legend_icon')
        .classed('focused', false)
        .classed('unfocused', true);
    d3.selectAll('.series.' + simplify(keyword) + ', .' + simplify(keyword) + ' .legend_icon')
        .classed('unfocused', false)
        .classed('focused', true);
}

function unHighlightKeyword(keyword) {
    
    d3.selectAll('.series, .legend_icon')
        .classed('focused', false)
        .classed('unfocused', false);
}

function chooseKeywords(keyword) {
    keywords_selected[keyword] = !keywords_selected[keyword];
    d3.select('.' + simplify(keyword) + ' .legend_icon')
        .classed('off', !keywords_selected[keyword]);
    
    prepareData();
}

function compareCollections(a, b) {
    if(a.starttime < b.starttime) 
        return -1;
    if(a.starttime > b.starttime)
        return 1;
    return 0;
}
function compareSeries(a, b) {
    if(a.sum !== undefined && b.sum !== undefined)
        return b.sum - a.sum;
    return a.order - b.order;
}

function chooseDisplayType() {
    console.log(options.display_type.get());
    if(options.display_type.is("lines")) {
        d3.selectAll('#choose_y_scale button')
            .attr('disabled', null);
    } else {
        d3.selectAll('#choose_y_scale button')
            .attr('disabled', function(d) {
                return this.id == 'linear' ? null : "";
            });
        
        // Make sure that linear is selected
        options.y_scale.set("linear");
        var container = d3.select('#choose_y_scale');
        container.selectAll(".active").classed("active", false);
        container.selectAll("#linear").classed("active", true);
    }
    
    chooseYScale();
}

//options.display_type.callback = function() { console.log("mmmm") };

function chooseYScale() {
    if(options.y_scale.is("linear")) {
        focus.y = d3.scale.linear()
            .range([focus.height, 0]);
        focus.yAxis.scale(focus.y)
            .tickFormat(null);
    } else if(options.y_scale.is("pow")) {
        focus.y = d3.scale.sqrt()
            .range([focus.height, 0]);
        focus.yAxis.scale(focus.y)
            .tickFormat(null);
    } else if(options.y_scale.is("log")) {
        focus.y = d3.scale.log()
            .clamp(true)
            .range([focus.height, 0]);
        focus.yAxis.scale(focus.y)
            .tickFormat(focus.y.tickFormat(10, ",.0f"));
    }
    display();
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