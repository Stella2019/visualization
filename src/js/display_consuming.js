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
    
    // Other variables
    self.getTweets_post = {};
    self.getTweets_count = 0;
    self.getTweets_progress = {};
}
Display.prototype = {
    init: function() { // Initialize D3 handles
        
        this.setColorScale();

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
                  + " Every " + options['View']['Resolution'].getLabel() + "");
    },
    contextChart: function() {
        disp.setContextTime(data.time.nested_min,
            data.time.nested_max);
        
        disp.context.y.domain([0, d3.max(data.time_totals, 
                function(d) { return d.value; })])
                .range([disp.context.height, 0]);

        disp.context.area
            .interpolate(options['View']['Shape'].get());

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
            .interpolate(options['View']['Shape'].get())
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
        if (options['View']['Plot Type'].is('overlap') | options['View']['Plot Type'].is('lines')) {
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
        var fill_opacity = options['View']['Plot Type'].is("lines") ? 0.0 : 
                        (options['View']['Plot Type'].is("overlap") ? 0.1 : 0.8);

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
        if(options['View']['Y Scale'].is("log"))
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

        if(options['View']['Y Max Toggle'].get() == "true") {
            y_max = options['View']['Y Max'].get();
        } else {
            if (options['View']['Plot Type'].is('overlap') | options['View']['Plot Type'].is('lines')) {
                y_max = biggest_datapoint;

                if(options['View']['Total Line'].is("true"))
                    y_max = Math.max(y_max, biggest_totalpoint);
            } else if (options['View']['Plot Type'].is('percent')) {
                y_max = 100;
            } else {
                y_max = highest_datapoint;
                if(options['View']['Total Line'].is("true"))
                    y_max = Math.max(y_max, biggest_totalpoint);
            }
            options['View']['Y Max'].updateInInterface(y_max);
        }

        disp.focus.y.domain([y_min, y_max])
            .range([disp.focus.height, 0]);
        disp.focus.y_total_line.domain([y_min, y_max])
            .range([disp.focus.height, 0]);

        if(options['View']['Y Scale'].is("log")) {
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

        // Set the manual field constraints
        var startDateTextBox = $('#choose_lView_lTime_Min');
        startDateTextBox.datetimepicker('option', 'minDate', time_min);
        startDateTextBox.datetimepicker('option', 'maxDate', endTime);
        startDateTextBox.datetimepicker("setDate", startTime);

        var endDateTextBox = $('#choose_lView_lTime_Max');
        endDateTextBox.datetimepicker('option', 'minDate', startTime);
        endDateTextBox.datetimepicker('option', 'maxDate', time_max);
        endDateTextBox.datetimepicker("setDate", endTime);
    },
    setFocusTime: function(origin) {
        var time_min_textbox = $('#choose_lView_lTime_Max');
        var time_max_textbox = $('#choose_lView_lTime_Max');
        var time_min_op = options['View']['Time Min'];
        var time_max_op = options['View']['Time Max'];
        var startTime, endTime;
        var brushEvent = false;

        // Get time from the originator of this request
        if(origin == "brush") {
            var times = disp.brush.extent();
            startTime = times[0];
            endTime   = times[1];

            brushEvent = true;
        } else if(origin == "input_field") {
            startTime = time_min_textbox.datetimepicker('getDate');
            endTime   = time_max_textbox.datetimepicker('getDate');
        } else if(origin == "button_time_to_start") { // The min and max possible?
            startTime = new Date(time_min_op.min);
        } else if(origin == "button_time_minus_6h") { // The min and max possible?
            startTime = time_min_op.get();
            startTime.setHours(startTime.getHours() - 6);
        } else if(origin == "button_time_minus_1h") { // The min and max possible?
            startTime = time_min_op.get();
            startTime.setHours(startTime.getHours() - 1);
        } else if(origin == "button_time_to_end") { // The min and max possible?
            endTime   = new Date(time_max_op.max);
        } else if(origin == "button_time_plus_1h") { // The min and max possible?
            startTime = time_min_op.get();
            startTime.setHours(startTime.getHours() + 1);
        } else if(origin == "button_time_plus_6h") { // The min and max possible?
            startTime = time_min_op.get();
            startTime.setHours(startTime.getHours() + 6);
        }

        if(!startTime)
            startTime = time_min_op.get();
        if(!endTime)
            endTime   = time_max_op.get();

        // Bound the start and end times
        if(startTime < time_min_op.min)
            startTime = new Date(time_min_op.min);
        if(endTime > time_max_op.max)
            endTime = new Date(time_max_op.max);
        if(startTime >= endTime ) {
            startTime = new Date(time_min_op.min);
            endTime = new Date(time_max_op.max);
        }

        time_min_textbox.datetimepicker("setDate", startTime + "");
        time_max_textbox.datetimepicker("setDate", endTime + "");

        time_min_op.set(startTime);
        time_max_op.set(endTime);

        if(startTime > time_min_op.min || endTime < time_max_op.max) {    
            if(!brushEvent) {
                // Update the brush
                disp.brush.extent([startTime, endTime])
                disp.brush(d3.select(".brush").transition());
                disp.brush.event(d3.select(".brush").transition())
            }
        } else {
            d3.selectAll(".brush").call(disp.brush.clear());//brush.clear();
        }

        options.recordState();

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
        var display_category = options['Series']['Chart Category'].get();
        var keyword_names_ordered = data.cats['Keyword'].series_plotted
            .map(function(series) { return series.name; });
        var type_order_numbers = [100, 200, 300, 400, 10100, 10200, 10300, 10400, 20100, 20200, 20300, 20400];
        
        // Set color domain
        if(display_category == 'Keyword') {
            disp.color.domain(keyword_names_ordered);    
            disp.typeColor.domain(type_order_numbers);
        } else {
            var display_names_ordered = data.cats[display_category].series_plotted
                .map(function(series) { return series.order; });
            disp.color.domain(display_names_ordered);    
            disp.typeColor.domain(type_order_numbers
                                  .concat(keyword_names_ordered));
        }

        // Set each series color
        data.series_arr.forEach(function(series) {
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
        if(options['View']['Plot Type'].is('percent')) {
            var biggest_totalpoint = data.total_tweets.reduce(function (cur_max, d) {
                return Math.max(cur_max, d.value);
            }, 0);
            multiplier = 100 / biggest_totalpoint;
        }

        disp.focus.area_total_line
            .interpolate(options['View']['Shape'].get())
            .y0(disp.focus.height)
            .y1(function (d) { return disp.focus.y_total_line(d.value * multiplier); });

        if(options['View']['Total Line'].is("false"))
            disp.focus.area_total_line.y1(disp.focus.height);

        transition.select("path.area_total_line")
            .attr("d", function(d) { return disp.focus.area_total_line(d)});

        // Set visibility
        legend.key.select('.legend_key_total_line')
            .classed('hidden', options['View']['Total Line'].is("false"));
    //    container.style('display', options['View']['Total Line'].is("true") ? 'block' : 'none');
    },
    newPopup: function(id) {        
        // Make factory for options
        var factory = {
            id: id,
            placement: 'bottom',
            trigger: 'hover',
            html: true,
            container: 'body',
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
    },
}