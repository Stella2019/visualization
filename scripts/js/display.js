function Tooltip() {
    this.div = {};
    this.info = {};
}
Tooltip.prototype = {
    init: function() {
        this.div = d3.select('#body')
            .append('div')
            .attr('class', 'tooltip');
    },
    setData: function(new_data) {
        if(JSON.stringify(this.data) != JSON.stringify(new_data)) {
            // Clear & set new parameters
            this.data = new_data;
            this.div.selectAll('*').remove();

            // Create table
            var rows = this.div.append('table')
                .selectAll('tr')
                .data(Object.keys(new_data))
                .enter()
                .append('tr');

            rows.append('th')
                .html(function(d) { return d + ":"; });

            rows.append('td')
                .html(function(d) { return new_data[d]; });
        }
    },
    on: function() {
        this.div
            .transition(200)
            .style('opacity', 1);
    },
    move: function(x, y) {
        this.div
            .style({
                left: x + 20 + "px",
                top: y + "px"
            });
    },
    off: function() {
        this.div
            .transition(200)
            .style('opacity', 0);
    }
};
function Progress(args) {
    // Grab parameters
    var valid_param = ['name', 'parent_id', 'full', 'text', 'steps'];
    Object.keys(args).forEach(function (item) {
        if(valid_param.includes(item)) {
            this[item] = args[item];
        }
    }, this);
    
    // Set defaults if they aren't already set
    this.name      = this.name      || "progress bar";
    this.parent_id = this.parent_id || "#timeseries_div";
    this.full      = this.full      || false;
    this.text      = this.text      || "Working";
    this.steps     = this.steps     || 100;
    
    // Make holding containers
    this.container_div = '';
    this.bar_div       = '';
    this.active        = false;
    
    // Set styles
    this.bar_style = {
        'width': '0%',
        'font-weight': 'bold',
        'padding': '10px 0px',
        'font-size': '1em',
        'text-align': 'center',
        'white-space': 'nowrap',
    };
    if(this.full) {
        this.container_style = {
            position: 'absolute',
            top: '0px',
            left: '0px',
            width: '100%',
            height: '100%',
            opacity: 0.9,
            background: 'grey',
            'z-index': 3
        }
        this.bar_style.padding = '5px 0px';
    } else {
        this.container_style = {
            position: 'absolute',
            top: '36%',
            left: '10%',
            width: '80%',
            height: '40px',
            background: '#ccc',
            'z-index': 3
        };
    }
}
Progress.prototype = {
    start: function() {        
        // Start progress bar
        this.container_div = d3.select(this.parent_id)
            .append('div')
            .attr('id', this.name + '_progress_div')
            .attr('class', 'progress')
            .style(this.container_style);
        
        this.bar_div = this.container_div
            .append('div')
            .attr({
                id: this.name + "_progress",
                class: "progress-bar progress-bar-striped active",
                role: "progressbar",
                'aria-valuenow': "0",
                'aria-valuemin': "0",
                'aria-valuemax': "100",
                'transition': "width .1s ease"
            })
            .style(this.bar_style)
            .text(this.text);
        
        this.active = true;
    },
    update: function(step, text) {
        var percentDone =  Math.floor(step * 100 / this.steps);
        this.text = text || this.text;
        
        this.bar_div
            .attr('aria-valuenow', percentDone + "")
            .style('width', percentDone + "%")
            .text(this.text);
    },
    end: function() {
        if(this.active) {
            this.container_div.remove();
            this.active = false;
        } else {
            // Nothing, it's already gone
        }
    },
};

function Display() {
    var self = this;
    
    // Make display sizes
    var plot_area      = {height: 500, width: 960};
    var focus = {};
    var context = {};
    focus.margin   = {top: 10,  right: 10, bottom: 100, left: 75};
    context.margin = {top: 430, right: 10, bottom: 20,  left: 75};
    focus.width    = plot_area.width  - focus.margin.left - focus.margin.right;
    focus.height   = plot_area.height - focus.margin.top  - focus.margin.bottom;
    context.width  = focus.width;
    context.height = plot_area.height - context.margin.top - context.margin.bottom;
    
    // Link to self
    self.focus = focus;
    self.context = context;
    self.plot_area = plot_area;
    self.color = {};
    self.typeColor = {};
    self.brush = {};
    self.tooltip = {};
}
Display.prototype = {
    setYScale: function() {
        var focus = this.focus;
        
        if(options.y_scale.is("linear")) {
            focus.y = d3.scale.linear()
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.linear()
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(null);
        } else if(options.y_scale.is("pow")) {
            focus.y = d3.scale.sqrt()
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.sqrt()
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(null);
        } else if(options.y_scale.is("log")) {
            focus.y = d3.scale.log()
                .clamp(true)
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.log()
                .clamp(true)
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(focus.y.tickFormat(10, ",.0f"));
        }
    },
    init: function() { // Initialize D3 handles
        var focus = this.focus;
        var context = this.context;
        var plot_area = this.plot_area;
    
        focus.x = d3.time.scale()
            .range([0, focus.width]);
        context.x = d3.time.scale()
            .range([0, context.width]);

        focus.y = d3.scale.linear()
            .range([focus.height, 0]);
        focus.y_total_line = d3.scale.linear()
            .range([focus.height, 0]);
        context.y = d3.scale.linear()
            .range([context.height, 0]);
        
        this.setColorScale();
        
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
        focus.yAxis_total_line = d3.svg.axis()
            .scale(focus.y_total_line)
            .orient("right");

        context.yAxis = d3.svg.axis()
            .scale(context.y)
            .ticks(2)
            .orient("left");

        focus.area = d3.svg.area()
            .interpolate(options.shape.get())
            .x(function (d) { return focus.x(d.timestamp); });
        focus.area_total_line = d3.svg.area()
            .interpolate(options.shape.get())
            .x(function (d) { return focus.x(d.timestamp); });

        context.area = d3.svg.area()
            .interpolate(options.shape.get())
            .x(function(d) { return context.x(d.timestamp); })
            .y0(context.height)
            .y1(function(d) { return context.y(d.value); });
        
        this.brush = d3.svg.brush()
            .x(context.x)
            .on("brush", function() { disp.setFocusTime('brush'); } );
        
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
            .attr('class', 'column_hover')
            .style('display', 'none')
            .style('fill', 'black')
            .style('stroke', 'black')
            .style('fill-opacity', '0.2')
            .style('stroke-opacity', '0.6');
        
        this.tooltip = new Tooltip();
        this.tooltip.init();
    },
    setFocusAxisLabels: function() {
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
            .text("Count of Tweets"
                  + " Every " + options.resolution.getLabel() + "");
    },
    contextChart: function() {
        disp.setContextTime(data.timestamps_nested[0],
            data.timestamps_nested[data.timestamps_nested.length - 1]);
        
        disp.context.y.domain([0, d3.max(data.time_totals, 
                function(d) { return d.value; })])
                .range([disp.context.height, 0]);

        disp.context.area
            .interpolate(options.shape.get());

        disp.context.svg.selectAll(".x, .area").remove();
        disp.context.svg.append("path")
            .datum(data.time_totals)
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
    },
    resetPlotArea: function() {
        // Set Time Domain and Axis
        disp.focus.x.domain(  [data.time.min, data.time.max]).clamp(true);
        disp.context.x.domain([data.time.min, data.time.max]);

        // Clear brush
        disp.brush.clear();
        disp.plot_area.svg.selectAll('.brush').call(disp.brush);
    },
    configurePlotArea: function() {
        // Set the Y Scale
        disp.setYScale();

        // Turn off the column hover if it is on
        disp.focus.svg.select('path.column_hover')
                    .style('display', 'none');

        // I want the starting chart to emanate from the
        // middle of the display.
        disp.focus.area
            .interpolate(options.shape.get())
            .y0(focus.height / 2)
            .y1(focus.height / 2);

        disp.setYAxes();
        disp.showTotalLine();
    },
    buildTimeseries: function() {
        // Bind new series to the graph
        var series = disp.focus.svg.selectAll(".series")
            .data(data.stacked);

        var series_paths = series.enter().append("g")
            .on("click", legend.chartClickGetTweets)
            .on("mouseover", legend.chartHoverEnter)
            .on("mousemove", legend.chartHoverMove)
            .on("mouseout", legend.chartHoverEnd);

        series.attr("class", function(d) {
                return "series " + d.id
            });

        series.exit().remove();

        series_paths.append("path")
            .attr("class", "area");
    },
    drawTimeseries: function() {
        // Define the parameters of the area
        if (options.display_type.is('overlap') | options.display_type.is('lines')) {
            disp.focus.area
                .y0(disp.focus.height)
                .y1(function (d) { return disp.focus.y(d.value); });
        } else {
            disp.focus.area
                .y0(function (d) { return disp.focus.y(d.value0); })
                .y1(function (d) { return disp.focus.y(d.value0 + d.value); });
        }

        // here we create the transition
        var transition = disp.focus.svg.selectAll(".series")
            .transition()
            .duration(750)

        // Transition to the new area
        var fill_opacity = options.display_type.is("lines") ? 0.0 : 
                        (options.display_type.is("overlap") ? 0.1 : 0.8);

        disp.focus.svg.selectAll(".series")
            .classed("lines", false);
        transition.select("path.area")
            .style("fill", function (d) { return d.fill; })
            .style("fill-opacity", fill_opacity)
            .style("stroke", function (d) { return d.stroke; })
            .attr("d", function(d) { return disp.focus.area(d.values)});

    },
    setYAxes: function() {
        // Set the Y Domain
        var y_min = 0;
        if(options.y_scale.is("log"))
            y_min = 1;

        var y_max = 100;
        var biggest_datapoint = // data is defined by its own maxes
            d3.max(data.stacked.map(function (d) {
                return d.max;
            }));
        var highest_datapoint = // because of stacked data
            d3.max(data.stacked[0].values.map(function (d) {
                return d.value0 + d.value;
            }));
        var biggest_totalpoint = 
            d3.max(data.total_tweets.map(function (d) {
                return d.value;
            }));

        if(options.y_max_toggle.get() == "true") {
            y_max = options.y_max.get();
        } else {
            if (options.display_type.is('overlap') | options.display_type.is('lines')) {
                y_max = biggest_datapoint;

                if(options.total_line.is("true"))
                    y_max = Math.max(y_max, biggest_totalpoint);
            } else if (options.display_type.is('percent')) {
                y_max = 100;
            } else {
                y_max = highest_datapoint;
                if(options.total_line.is("true"))
                    y_max = Math.max(y_max, biggest_totalpoint);
            }
            options.y_max.update(y_max);
            options.y_max.set(y_max);
        }

        disp.focus.y.domain([y_min, y_max])
            .range([disp.focus.height, 0]);
        disp.focus.y_total_line.domain([y_min, y_max])
            .range([disp.focus.height, 0]);

        if(options.y_scale.is("log")) {
            disp.focus.yAxis.scale(disp.focus.y)
                .tickFormat(disp.focus.y.tickFormat(10, ",.0f"));
        }
        
        // Create y Axises
        var ax = disp.focus.svg.select("g#yAxis");
        if(!ax[0][0])
            ax = disp.focus.svg.append('g').attr('id', 'yAxis');
        ax.attr("class", "y axis")
            .transition().duration(1000)
            .call(disp.focus.yAxis);

        ax = disp.context.svg.select("g#context_yAxis");
        if(!ax[0][0])
            ax = disp.context.svg.append('g').attr('id', 'context_yAxis');
        ax.attr("class", "context_y axis")
            .call(disp.context.yAxis);
    },
    setContextTime: function(time_min, time_max) {
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
        disp.context.x.domain([time_min, time_max]);
        disp.focus.x.domain(disp.brush.empty() ? [startTime, endTime] : disp.brush.extent());

        // Initialize the brush if it isn't identical
        if(startTime > time_min || endTime < time_max) {
            disp.brush.extent([startTime, endTime]);
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
    },
    setFocusTime: function(origin) {
        var startDateTextBox = $('#choose_time_min');
        var endDateTextBox = $('#choose_time_max');
        var startTime, endTime;
        var brushEvent = false;

        // Get time from the originator of this request
        if(origin == "brush") {
            var times = disp.brush.extent();
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
                disp.brush.extent([startTime, endTime])
                disp.brush(d3.select(".brush").transition());
                disp.brush.event(d3.select(".brush").transition())
            }
        } else {
            d3.selectAll(".brush").call(disp.brush.clear());//brush.clear();
        }

        options.recordState('time_min');
        options.recordState('time_max');

        disp.focus.x.domain(disp.brush.empty() ? disp.context.x.domain() : disp.brush.extent());
        disp.focus.svg.selectAll("path.area")
            .attr("d", function(d) { return disp.focus.area(d.values)});
        disp.focus.svg.selectAll("path.area_total_line")
            .attr("d", function(d) { return disp.focus.area_total_line(d)});
        disp.focus.svg.select(".x.axis")
            .call(disp.focus.xAxis);
    },
    setColors: function() {
        disp.setColorScale();

        // Get parameters
        var display_category = options.chart_category.get();
        var keyword_names_ordered = data.series_byCat['Keyword']
            .map(function(series) { return series.name; });
        var type_order_numbers = [100, 200, 300, 400, 10100, 10200, 10300, 10400, 20100, 20200, 20300, 20400];
        
        // Set color domain
        if(display_category == 'Keyword') {
            disp.color.domain(keyword_names_ordered);    
            disp.typeColor.domain(type_order_numbers);
        } else {
            var display_names_ordered = data.series_byCat[display_category]
                .map(function(series) { return series.order; });
            disp.color.domain(display_names_ordered);    
            disp.typeColor.domain(type_order_numbers
                                  .concat(keyword_names_ordered));
        }

        // Set each series color
        data.series.map(function(series) {
            var key = series.category == 'Keyword' ? 'name' : 'order';
            
            if(series.category == display_category) {
                series.fill = disp.color(series[key]);
            } else {
                series.fill = disp.typeColor(series[key]);
            }
            series.stroke = d3.rgb(series.fill).darker();

            d3.select("." + series.id + " .legend_icon")
                .style('fill', series.fill)
                .style('stroke', series.stroke);
        });
    },
    setColorScale: function() {
//        this.typeColor = d3.scale.category20c();
        this.typeColor = d3.scale.ordinal()
//            .range(["#AAA", "#CCC", "#999", "#BBB"]);
            .range(["#CCC"]);
        
        
        switch(options.color_scale.get()) {
            case "category10":
                this.color = d3.scale.category10();
                break;
            case "category20":
                this.color = d3.scale.category20();
                break;
            case "category20b":
                this.color = d3.scale.category20b();
                break;
            case "category20c":
                this.color = d3.scale.category20c();
                break;
            default:
                this.color = d3.scale.category10();
                break;
        }
    },
    getTimeHoveringOverAxis: function(svg_element) {
        var time = {}
        var xy = d3.mouse(svg_element);
        time.hover = disp.focus.x.invert(xy[0]);
        var coeff = 1000 * 60; // get a minute on other side
        if(options.resolution.is('tenminute')) {
            coeff *= 10;
        } else if(options.resolution.is('hour')) {
            coeff *= 60;
        } else if(options.resolution.is('day')) {
            coeff *= 60 * 24;
        }
        time.min = new Date(Math.floor(time.hover.getTime() / coeff) * coeff)
        time.max = new Date(time.min.getTime() + coeff)
        
        return time;
    },
    showTotalLine: function() {    
        // Find or create context line
        var container = disp.focus.svg.select("g#y_total_line");
        if(!container[0][0]) {
            container = disp.focus.svg.append('g')
                .attr('id', 'y_total_line');
            container.append('path')
                .attr('class', 'area_total_line total_line')
        }

        // Update Data
        container.data([data.total_tweets]);

        var transition = container
            .transition()
            .duration(750);

        var multiplier = 1;
        if(options.display_type.is('percent')) {
            var biggest_totalpoint = data.total_tweets.reduce(function (cur_max, d) {
                return Math.max(cur_max, d.value);
            }, 0);
            multiplier = 100 / biggest_totalpoint;
        }

        disp.focus.area_total_line
            .interpolate(options.shape.get())
            .y0(disp.focus.height)
            .y1(function (d) { return disp.focus.y_total_line(d.value * multiplier); });

        if(options.total_line.is("false"))
            disp.focus.area_total_line.y1(disp.focus.height);

        transition.select("path.area_total_line")
            .attr("d", function(d) { return disp.focus.area_total_line(d)});

        // Set visibility
        legend.key.select('.legend_key_total_line')
            .classed('hidden', options.total_line.is("false"));
    //    container.style('display', options.total_line.is("true") ? 'block' : 'none');
    },
    alert: function(text, style_class, parent) {
        if(!style_class)
            style_class = 'warning';
        if(!parent)
            parent = '#body';
        
        var style = {
            position: 'absolute',
            top: '50%',
            transform: 'translate(0%, -50%)',
            left: '20%',
            width: '60%',
            'z-index': 4
        }
        
        var alert_shadow = d3.select(parent).append('div')
            .attr('class', 'alert_outer')
            .style({
                'width': '100%',
                'height': '100%',
                'position': 'absolute',
                'top': 0,
                'left': 0
            })
            .on('click', function() {
                d3.select('.alert_outer').remove();
            });
        
        var alert_div = alert_shadow.append('div')
            .attr({
                'class': 'alert alert-' + style_class + ' alert-dismissible',
                'role': 'alert'
            })
            .style(style);
        
        alert_div.append('button')
            .attr({'type': 'button',
                   'class': 'close', 
                   'data-dismiss': 'alert',
                   'aria-label': 'Close'})
            .append('span')
            .attr('aria-hidden', 'true')
            .html('&times;');
        
        alert_div.append('span')
            .html(text);
    },
    setTitle: function() {
        d3.select('#chart-title')
            .html('<small>' + data.collection.Type + ':</small> ' + 
                  data.collection.DisplayName);
    },
    tweetsModal: function(filedata, post, title) {

        d3.select('#selectedTweetsModal .modal-title')
            .html(title);

        // Clear any data still in the modal
        d3.select('#selectedTweetsModal .modal-options')
            .selectAll('*').remove();
        var modal_body = d3.select('#selectedTweetsModal .modal-body');
        modal_body.selectAll('*').remove();

        // Report errors if they happened
        if(filedata.indexOf('Maximum execution time') >= 0) {
            modal_body.append('div')
                .attr('class', 'text-center')
                .html("Error retrieving tweets. <br /><br /> Query took too long");
        } else if (filedata.indexOf('Fatal error') >= 0 || filedata.indexOf('Errormessage') >= 0) {
            modal_body.append('div')
                .attr('class', 'text-center')
                .html("Error retrieving tweets. <br /><br /> " + filedata);
        } else {
            // Otherwise, parse the data
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
                        var content = '<span class="badge"><a href="https://twitter.com/emcomp/status/' + d['ID'] + '">' + d['ID'] + '</a></span>';
                        content += d['Timestamp'] + ' ';
                        content += d['Username'] + ' said: ';
                        content += "<br />";
                        content += d['Text'];
                        content += "<br />";
                        if(d['Distinct'] == '1')
                            content += 'distinct ';
                        content += d['Type'];
                        if(d['Origin'])
                            content += ' of <a href="https://twitter.com/emcomp/status/' + d['Origin'] + '">#' + d['Origin'] + '</a>'
                        return content;
                    });
                
                d3.select('.modal-options').selectAll('button')
                    .data(options.fetched_tweet_order.available)
                    .enter()
                    .append('button')
                    .attr('class', 'btn btn-primary')
                    .style('font-weight', function(d) {
                        if(d == options.fetched_tweet_order.indexCur())
                            return 'bold';
                        return 'normal';
                    })
                    .text(function(d) {
                        return options.fetched_tweet_order.labels[d];
                    })
                    .on('click', function(d) {
                        options.fetched_tweet_order.click(d);
                        
//                        title = title.replace('Random', '');
                        if(options.fetched_tweet_order.is('rand')) {
                            post.rand = '';
//                            title = 'Random ' + title;
                        } else {
                            delete post.rand;
                        }
                        
                        // Fetch new data
                        data.callPHP('tweets/get', post, function(filedata) {
                            disp.tweetsModal(filedata, post, title);
                        }, function() { 
                            disp.alert('Unable to fetch new data', 'danger');
                        });
                    });
                
                data.callPHP('tweets/count', post, function(file_data) {
                    var count = JSON.parse(file_data);
                    
                    d3.select('#selectedTweetsModal .modal-title')
                        .html(count[0]['count'] + " " + title);
                });
            }
        }

        $('#selectedTweetsModal').modal();
    },
    newPopup: function(id) {        
        // Make factory for options
        var factory = {
            id: id,
            placement: 'bottom',
            trigger: 'hover',
            html: true,
            content: '',
            title: '',
            create: function() {
                $(this.id).popover({
                    html: this.html,
                    placement: this.placement,
                    content: this.content,
                    trigger: this.trigger,
                    title: this.title
                });
            },
            destroy: function() {
                $(this.id).popover('destroy');
            },
            set: function(key, value) {
                this.destroy();
                this[key] = value;
                this.create();
                return this;
            }
        };
        factory.create();
        
        return factory;
    }
}
