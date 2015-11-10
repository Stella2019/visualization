Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

var collections;
var collection_names = ["SahafiHotelAttack", "Sinai Plane Crash", "NORAD blimp on the loose", "Earthquake in Pakistan and Afghanistan", "Earthquake in South Asia", "Hurricane Patricia - Spanish terms", "Flooding from Patricia", "Hurricane Patricia", "Wilfrid Laurier Lockdown", "Black Lives Matter Collection", "Ankara Bombing", "Hurricane Oho", "Doctors without Borders", "Townhall gunmen", "umpqua college shooting", "Hurricane Joaquin - hurricane terms", "Hurricane Joaquin - flooding terms", "Yemen mosque bombing", "Chile", "Flash Flood", "California Valley Fire", "Grand Mosque accident", "Refugee crisis", "Karachi Explosion", "Chicago Shooting", "Western WA storms", "Tropical Storm Erika", "WA Wildfires - August", "Cotopaxi volcano", "FAA outage", "Chemical Spill - August 2015", "Alaska Earthquake - July 26", "Navy Shooting", "NYSE Stock Exchange Cant Exchange", "India Earthquake"];
var data_stacked, data, data_csv, data_totals;
var select;
var keywords, keywords_selected;
var chart_options = {
    display_type: "stacked_area",
    resolution: "tenminute",
    y_scale: "linear"
}

window.onload = initialize;

var margin, width, height,
    parseDate, formatPercent,
    x, y, color,
    xAxis, yAxis,
    area, stack,
    svg;
var focus, context, brush,
    context_margin, context_height,
    context_x, context_y,
    context_xAxis, context_yAxis,
    context_area;

function initialize() {

    margin = {top: 10, right: 10, bottom: 100, left: 75};
    context_margin = {top: 430, right: 10, bottom: 20, left: 75};
    width = 960 - margin.left - margin.right;
    height = 500 - margin.top - margin.bottom;
    context_height = 500 - context_margin.top - context_margin.bottom;

    parseDate = d3.time.format("%Y%m%d_%H%M").parse;
    formatPercent = d3.format(".0%");

    x = d3.time.scale()
        .range([0, width]);
    context_x = d3.time.scale()
        .range([0, width]);

    y = d3.scale.linear()
        .range([height, 0]);
    
    context_y = d3.scale.linear()
        .range([context_height, 0]);

    color = d3.scale.category10();

    xAxis = d3.svg.axis()
        .scale(x)
        .tickSize(-height)
//        .tickFormat(d3.time.format('%b %d'))
        .orient("bottom");
    
    context_xAxis = d3.svg.axis()
        .scale(context_x)
        .orient("bottom");
    
    yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");
    
    context_yAxis = d3.svg.axis()
        .scale(context_y)
        .ticks(2)
        .orient("left");

    brush = d3.svg.brush()
        .x(context_x)
        .on("brush", brushed);
    
    area = d3.svg.area()
        .interpolate("basis")
        .x(function (d) { return x(d.timestamp); });

    context_area = d3.svg.area()
        .interpolate("basis")
        .x(function(d) { return context_x(d.timestamp); })
        .y0(context_height)
        .y1(function(d) { return context_y(d.tweets); });
    
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
    
    svg = d3.select("svg#timeseries")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    svg.append("defs").append("clipPath")
        .attr("id", "clip")
      .append("rect")
        .attr("width", width)
        .attr("height", height);

    focus = svg.append("g")
        .attr("class", "focus")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    context = svg.append("g")
        .attr("class", "context")
        .attr("transform", "translate(" + context_margin.left + "," + context_margin.top + ")");
    
    buildInterface();
}

function changeData() {
    var selectedIndex = d3.select("select#chooseCollection").property('selectedIndex');
    var collection = collection_names[selectedIndex];

    d3.csv("capture_data/" + collection + ".csv", function(error, data_file) {
        if (error) throw error;
	
        data_csv = data_file;
        
        // Get the keywords
        keywords = d3.keys(data_csv[0]).filter(function (key) { return key !== "timestamp" && key !== 'tweets'; });
        keywords_selected = {};
        keywords.forEach(function(d) {
            keywords_selected[d] = true; 
        });
        
        // Parse dates and ints
        data_csv.forEach(function (d) {
            d.timestamp = parseDate(d.timestamp);
            d.tweets = parseInt(d.tweets);
            keywords.map(function(keyword) {
                d[keyword] = parseInt(d[keyword]);
            });
        });

        buildLegend();

        // Set Time Domain and Axis
        var x_min = data_csv[0].timestamp;
        var x_max = data_csv[data_csv.length - 1].timestamp;
        x.domain([x_min, x_max]).clamp(true);
        context_x.domain([x_min, x_max]);
    
        // Clear brush
        brush.clear();
        svg.selectAll('.brush').call(brush);
        
        prepareData();
    });
}

function prepareData() {
    // Aggregate on time depending on the resolution
    var data_nested = d3.nest()
        .key(function (d) {
            time = new Date(d.timestamp);
            if(chart_options.resolution == "hour" || chart_options.resolution == "day")
                time.setMinutes(0);
            if(chart_options.resolution == "day")
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
        .entries(data_csv);

    // Convert data to a format the charts can use
    var data_ready = [];
    data_nested.map(function (d, i) {
        new_data = d.values;
        new_data.timestamp = new Date(d.key);
        data_ready.push(new_data);
    });
    
    data_totals = data_ready.map(function(datum) {
        return Math.max(keywords.reduce(function(running_sum, word) {
            return running_sum += datum[word];
        }, 0), 1);
    });
    
    data = keywords.map(function(name) {
            return {
                name: name,
                values: data_ready.map(function(d) {
                    return {timestamp: d.timestamp, value: d[name]};
                }),
                max_value: data_ready.reduce(function(cur_max, d) {
                    return Math.max(cur_max, d[name]);
                }, 0)
            };
        });
    
    // Set Time Domain and Axis appropriate to the resolution
    var x_min = data_ready[0].timestamp;
    var x_max = data_ready[data_ready.length - 1].timestamp;
//    x.domain([x_min, x_max]);
    context_x.domain([x_min, x_max]);
    x.domain(brush.empty() ? context_x.domain() : brush.extent());
    
    // Set xAxis
//    var n_days = Math.floor(data_csv.length / 144),
//        n_hours = Math.floor(data_csv.length / 6),
//        n_10minutes = data_csv.length,
//        n_ticks = 10,
//        tick_format = '%b %d';
    
//    n_datapoints = data_ready.length;
//    if(n_days > 6 | resolution == "day") {
//        n_ticks = Math.min(n_days, n_ticks);
//    } else if (n_days > 2) {
//        n_ticks = Math.min(n_days * 2, n_ticks);
//        tick_format = '%b %d %p';
//    } else {
//        n_ticks = Math.min(n_hours, n_ticks);
//        tick_format = '%b %d %-H:00';
//    }
//    xAxis.ticks(n_ticks);
//        .tickFormat(d3.time.format(tick_format));
    
    // Display the xAxis
    var ax = focus.select("g#xAxis");
    if(!ax[0][0])
        ax = focus.append('g').attr('id', 'xAxis');
    ax.attr('class','x axis')
        .attr('transform', 'translate(0,' + height + ')')
        .transition().duration(1000)
        .call(xAxis);
    
    // Display values on the context chart
    context_y.domain([0, data_ready.reduce(function (cur_max, series) {
            return Math.max(cur_max, series["tweets"]);
        }, 0)])
            .range([context_height, 0]);
    
    context.selectAll(".x, .area").remove();
    context.append("path")
        .datum(data_ready)
        .attr("class", "area")
        .attr("d", context_area);

    context.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + context_height + ")")
        .call(context_xAxis);

    context.append("g")
        .attr("class", "x brush")
        .call(brush)
        .selectAll("rect")
        .attr("y", -6)
        .attr("height", context_height + 7);
    
    // Display the data
    display();
}

function display() {
    if (chart_options.display_type == "stream_wiggle") {
        stack.offset("wiggle");
    } else if (chart_options.display_type == "stream_expand") {
        stack.offset("expand");
    } else if (chart_options.display_type == "stream_silhouette") {
        stack.offset("silhouette");
    } else {
        stack.offset("zero");
    }
    
//    if(display_type === "percent_area") {
//        stack.y(function (d) { return d.value; });
//    } else {
//        stack.y(function (d) { return d.value; }));
//    }

    // Set stack representation of data
    if(chart_options.display_type === "percent_area") {
        data_100 = data.map(function(series) {
            var new_series = JSON.parse(JSON.stringify(series));
            new_series.values = new_series.values.map(function(datum, i) {
//                console.log(datum);
                var new_datum = datum;
                new_datum.timestamp = new Date(new_datum.timestamp);
                new_datum.value *= 100 / data_totals[i];
//                console.log(new_datum);
                return new_datum;
            });
            return new_series;            
        });
//        console.log(data[0].values[0]);
//        console.log(data_100[0].values[0]);
        
        data_stacked = stack(data_100);
//        return;
    } else {
        data_stacked = stack(data);
    }
    
    // Change data for display
    n_series = data_stacked.length;
    n_datapoints = data_stacked[0].values.length;
    if(chart_options.display_type == "stream_separate") {
        for (var i = n_series - 1; i >= 0; i--) {
            data_stacked[i].offset = 0;
            if(i < n_series - 1) {
                data_stacked[i].offset = data_stacked[i + 1].offset;
                if(keywords_selected[data_stacked[i + 1].name])
                    data_stacked[i].offset += data_stacked[i + 1].max_value;
            }
            
            data_stacked[i].values.map(function(datum) {
                datum.value0 = data_stacked[i].offset;
            });
        }
    } 
//    else if(display_type == "percent_area") {
//        for (var i = 0; i < n_datapoints; i++) {
//            current_sum = data_stacked.reduce(function(running_sum, datum) {
//                return running_sum + datum.values[i].value;
//            }, 0);
//            data_stacked.map(function(datum) {
//                datum.values[i].value *= 100 / current_sum;
//            });
//        }
//    }

    // I want the starting chart to emanate from the
    // middle of the display.
    area.y0(height / 2)
        .y1(height / 2);

    // Bind new data to the graph
    
    var series = focus.selectAll(".series")
        .data(data_stacked);
 
    var series_paths = series.enter().append("g")
        .on("mouseover", highlightKeyword)
        .on("mouseout", unHighlightKeyword);
    
    series.attr("class", function(d) {
            return "series " + simplify(d.name)
        });
    
    series.exit().remove();
 
    series_paths.append("path")
        .attr("class", "area")
        .style("stroke-opacity", 0)
        .style("fill", function (d) { return color(d.name); })
        .style("stroke", function (d) { return color(d.name); })
        .attr("d", function (d) { return area(d.values); });
 
    // Set the Y Domain
    var y_min = 0;
    if(chart_options.y_scale == "log")
        y_min = 1;
    
    var y_max = 100;
    if (chart_options.display_type == 'lines') {
        y_max = d3.max(data_stacked.map(function (d) {
            return d.max_value;
        }));
    } else if (chart_options.display_type == 'percent_area') {
        y_max = 100;
    } else {
        y_max = d3.max(data_stacked[0].values.map(function (d) {
            return d.value0 + d.value;
        }));
    }	
    y.domain([y_min, y_max])
        .range([height, 0]);
    
    if(chart_options.y_scale == "log") { // Inform the yAxis
        yAxis.scale(y)
            .tickFormat(y.tickFormat(10, ",.0f"));
    }

    // Create y Axises
    ax = focus.select("g#yAxis");
    if(!ax[0][0])
        ax = focus.append('g').attr('id', 'yAxis');
    ax.attr("class", "y axis")
        .transition().duration(1000)
        .call(yAxis);
    
    ax = context.select("g#context_yAxis");
    if(!ax[0][0])
        ax = context.append('g').attr('id', 'context_yAxis');
    ax.attr("class", "context_y axis")
        .call(context_yAxis);
    
    // Define the parameters of the area
    if (chart_options.display_type === 'overlap_area' | chart_options.display_type === 'lines') {
        area.y0(height)
            .y1(function (d) { return y(d.value); });
//    } else if (display_type === "percent_area") {
//        area.y0(height)
//            .y1(function (d) { return y(d.value); });
    } else {
        area.y0(function (d) { return y(d.value0); })
            .y1(function (d) { return y(d.value0 + d.value); });
    }
    
    // here we create the transition
    transition = focus.selectAll(".series")
        .transition()
        .duration(750)
    
    // Transition to the new area
    if(chart_options.display_type == "lines") {
        focus.selectAll(".series")
            .classed("lines", true);
        transition.select("path.area")
            .style("fill-opacity", 0.1)
            .style("stroke-opacity", 1.0)
            .attr("d", function(d) { return area(d.values)});
    } else {
        focus.selectAll(".series")
            .classed("lines", false);
        transition.select("path.area")
            .style("fill-opacity", 1.0)
            .attr("d", function(d) { return area(d.values)});
    }
}

function brushed() {
    x.domain(brush.empty() ? context_x.domain() : brush.extent());
    focus.selectAll("path.area")
        .attr("d", function(d) { return area(d.values)});
    focus.select(".x.axis")
//        .transition().duration(1000)
        .call(xAxis);
}

function buildInterface() {
    // Collection selection
    d3.json("capture_data/collections.json", function(error, collections_file) {
        if (error) throw error;
        
        collections_file.sort(compareCollections);
        collections_file.reverse();
        collections = collections_file;
        
//        collection_names = [];
//        collections.reduce(function (cur_list, collection) {
//            if(URLExists('capture_data/' + collection.name + '.csv'))
//                collection_names.push(collection.name);
//        }, []);
//        console.log(collection_names);
	
        select  = d3.select("select#chooseCollection").on('change', changeData);
        var options = select.selectAll("option").data(collection_names);

        options.enter().append("option").text(function (d) { return d; });
        
        
        // Add display type selection
        display_types = [
            {name: "Stacked", id: "stacked_area"},
//            {name: "Overlap", id: "overlap_area"},
            {name: "Overlap", id: "lines"},
            {name: "Stream", id: "stream_silhouette"},
//            {name: "Wiggle", id: "stream_wiggle"},
            {name: "Separate", id: "stream_separate"},
            {name: "100%", id: "percent_area"}
        ];
        buildOption("display_type", display_types, chooseDisplayType, 0);
        
        // Add switch for time resolution
        resolutions = [
            {name: "Day", id: "day"},
            {name: "Hour", id: "hour"},
            {name: "10 Minute", id: "tenminute"}
        ];
        buildOption("resolution", resolutions, prepareData, 1);
        
        // Add switch for time resolution
        yscales = [
            {name: "Linear", id: "linear"},
            {name: "Power", id: "pow"},
            {name: "Log", id: "log"}
        ];
        buildOption("y_scale", yscales, chooseYScale, 0);

        changeData();
    });
}
    
function buildLegend () {
    // Make the legend
    color.domain(keywords);

    var legend = d3.select('#legend');
    var legend_entries = legend
        .selectAll('div.legend_entry')
        .data(keywords);

    legend_entries.enter().append('div')
        .attr('class', function(d) {
            return 'legend_entry ' + simplify(d);
        })
        .attr('draggable', true)
        .on('click', chooseKeywords)
        .on('mouseover', highlightKeyword)
        .on('mouseout', unHighlightKeyword);

    legend_entries.selectAll('div.legend_icon')
        .data(function(d) { return [d]; })
        .enter().append('div')
        .attr('class', 'legend_icon');

    legend_entries.selectAll('div.legend_label')
        .data(function(d) { return [d]; })
        .enter().append('div')
        .attr('class', 'legend_label');
    
    legend_entries.exit().remove();
    
    legend_entries
        .attr('class', function(d) {
            return 'legend_entry ' + simplify(d);
        });
    
    legend.selectAll('div.legend_icon')
        .style('background-color', function (d) { return color(d); })
        .style('border-color', function (d) { return color(d); });
    
    legend.selectAll('div.legend_label')
        .text(function (d) {
            return d;
        });
    
    
    
    /////////////////
    
//    var labels = legend.enter();
//    
//    labels.append('div')
//        .attr('class', function(d) {
//            return 'legend_icon ' + simplify(d);
//        })
//        .style('background-color', function (d) { return color(d); })
//        .style('border-color', function (d) { return color(d); })
//        .attr('draggable', true)
//        .on('click', chooseKeywords)
//        .on('mouseover', highlightKeyword)
//        .on('mouseout', unHighlightKeyword);
//
//    legend.html(function (d) {
//        return "<span class='legend_label'>" + d + "</span>";
//    });
//
//    legend.exit().remove();
    
//    legend
//        .attr('class', function(d) {
//            return 'legend_icon ' + simplify(d);
//        });
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
    
        
//    if((typeof datum) == "string") {
//        datum = data_stacked.reduce(function (result, current) {
//            if (current.name == datum)
//                return current;
//            else
//                return result;
//        });
//    }
    
//    focus.append("path")
//        .attr("d", area(datum.values))
//        .attr("id", "arcSelection")
//        .style("fill", "white")
//        .style("opacity", "0.5")
//        .style("stroke", "none")
//        .style("pointer-events", "none");
}

function unHighlightKeyword(keyword) {
    
    d3.selectAll('.series, .legend_icon')
        .classed('focused', false)
        .classed('unfocused', false);
//    d3.select('.series.' + simplify(datum.name))
//        .classed('on', false);
    
//    d3.select("#arcSelection").remove();
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

function buildOption(type, values, callBack, default_option){
    var superId = "choose_" + type;
    var container = d3.select("#choices").append("div")
        .attr("class", "choice")
        .style("text-transform", "capitalize")
        .html(" " + type.replace("_", " ") + ": ")
        .append("div")
        .attr("id", superId)
        .attr("class", "btn-group");
    
    container.selectAll("button")
        .data(values)
        .enter()
        .append("button")
        .attr("type", "button")
        .attr("class", "btn btn-default")
        .attr("id", function(d) { return d.id; })
        .text(function(d) { return d.name; })
        .on("click", function(d) {
            container.select('.active').classed('active', false);
            container.select('#' + d.id).classed('active', true);
            chart_options[type] = d.id;
        
            callBack();
        });
    
    container.select('#' + values[default_option].id).classed('active', true);
    chart_options[type] = values[default_option].id;
}

function chooseDisplayType() {
    if(chart_options.display_type == "lines") {
        d3.selectAll('#choose_y_scale button')
            .attr('disabled', null);
    } else {
        d3.selectAll('#choose_y_scale button')
            .attr('disabled', function(d) { console.log(this); return this.id == 'linear' ? null : ""; });
        
        // Make sure that linear is selected
        chart_options.y_scale = "linear";
        var container = d3.select('#choose_y_scale');
        container.selectAll(".active").classed("active", false);
        container.selectAll("#linear").classed("active", true);
    }
    
    chooseYScale();
}

function chooseYScale() {
    if(chart_options.y_scale == "linear") {
        y = d3.scale.linear()
            .range([height, 0]);
        yAxis.scale(y)
            .tickFormat(null);
    } else if(chart_options.y_scale == "pow") {
        y = d3.scale.sqrt()
            .range([height, 0]);
        yAxis.scale(y)
            .tickFormat(null);
    } else if(chart_options.y_scale == "log") {
        y = d3.scale.log().clamp(true)
            .range([height, 0]);
        yAxis.scale(y)
            .tickFormat(y.tickFormat(10, ",.0f"));
    }
    display();
}

function simplify(str) {
    return "l" + str.replace(/[\s#]+/g, '_');
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