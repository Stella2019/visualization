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
    setYScale: function() {
        var focus = this.focus;
        
        if(options['View']['Y Scale'].is("linear")) {
            focus.y = d3.scale.linear()
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.linear()
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(null);
        } else if(options['View']['Y Scale'].is("pow")) {
            focus.y = d3.scale.sqrt()
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.sqrt()
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(null);
        } else if(options['View']['Y Scale'].is("log")) {
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
            .interpolate(options['View']['Shape'].get())
            .x(function (d) { return focus.x(d.timestamp); });
        focus.area_total_line = d3.svg.area()
            .interpolate(options['View']['Shape'].get())
            .x(function (d) { return focus.x(d.timestamp); });

        context.area = d3.svg.area()
            .interpolate(options['View']['Shape'].get())
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
        // Establish the maximum and minimum time of the data series
        var startTime = options['View']['Time Min'].get();
        var endTime =   options['View']['Time Max'].get();
        if(typeof(startTime) == 'string')
            startTime = new Date(startTime);
        if(typeof(endTime) == 'string')
            endTime = new Date(endTime);

        if(startTime.getTime() == endTime.getTime()) {
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
        options['View']['Time Min'].set(startTime);
        options['View']['Time Min'].min = new Date(time_min);
        options['View']['Time Max'].set(endTime);
        options['View']['Time Max'].max = new Date(time_max);

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
    setColorScale: function() {
//        this.typeColor = d3.scale.category20c();
        this.typeColor = d3.scale.ordinal()
//            .range(["#AAA", "#CCC", "#999", "#BBB"]);
            .range(["#CCC"]);
        
        
        switch(options['View']['Color Scale'].get()) {
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
        if(options['View']['Resolution'].is('tenminute')) {
            coeff *= 10;
        } else if(options['View']['Resolution'].is('hour')) {
            coeff *= 60;
        } else if(options['View']['Resolution'].is('day')) {
            coeff *= 60 * 24;
        }
        time.min = new Date(Math.floor(time.hover.getTime() / coeff) * coeff);
        
        time.min = data.timeInterpolate(time.hover);
        time.max = new Date(time.min.getTime() + coeff);
        
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
    tweetsModal: function(post, title) {

        var title_div = d3.select('#modal .modal-title').html('');
        
//        title_div.append('span').html('Tweets');
        title_div.append('span').html(title);
        title_div.append('span').attr('class', 'tweet_modal_count');

        // Clear any data still in the modal
        d3.select('#modal .modal-options')
            .selectAll('*').remove();
        disp.getTweets_post = post;
        disp.getTweets_post.offset = 0;
        disp.getTweets_post.limit = 5;
        disp.getTweets_count = 0;
        
        // Add Options
        var options_div = d3.select('.modal-options');

        var order_div = options_div.append('div')
            .attr('class', 'btn-group')
            .style('margin-bottom', '0px');

        order_div.append('span')
            .attr('class', 'btn btn-default')
            .attr('disabled', '')
            .text('Order by:');

        order_div.selectAll('button.tweet_modal_order')
            .data(options['Analysis']['Fetched Tweet Order'].available)
            .enter()
            .append('button')
            .attr('class', 'btn tweet_modal_order')
            .text(function(d) {
                return options['Analysis']['Fetched Tweet Order'].labels[d];
            })
            .on('click', function(d) {
                options['Analysis']['Fetched Tweet Order'].click(d);

                var post = disp.getTweets_post;
                if(options['Analysis']['Fetched Tweet Order'].is('rand')) {
                    post.rand = true;
                    delete post.order_prevalence;
                } else if(options['Analysis']['Fetched Tweet Order'].is('prevalence')) {
                    post.order_prevalence = true;
                    delete post.rand;
                } else {
                    delete post.order_prevalence;
                    delete post.rand;
                }

                // Fetch new data
                disp.getTweets_progress.start();
                data.callPHP('tweets/get', post,
                    disp.tweetModalContent, disp.tweetModalContent);
            });

        options_div.append('div')
            .attr('class', 'btn-group')
            .style('margin-bottom', '0px')
            .selectAll('button.tweet_modal_step')
            .data([-10000, -5, 5])
            .enter()
            .append('button')
            .attr('class', 'btn btn-primary tweet_modal_step')
            .on('click', function(d) {
                var post = disp.getTweets_post;

                post.offset = Math.max(post.offset + d, 0);
                disp.tweetModalStyle();

                // Fetch new data
                disp.getTweets_progress.start();
                data.callPHP('tweets/get', post,
                    disp.tweetModalContent, disp.tweetModalContent);
            })
            .append('span')
            .attr('class', function(d) {
                var symbol = 'step-backward';
                if(d == -5)
                    symbol = 'chevron-left';
                if(d == 5)
                    symbol = 'chevron-right';
            
                return 'glyphicon glyphicon-' + symbol;
            });

        // Get the counts
        data.callPHP('tweets/count', post, function(file_data) {
            var count = JSON.parse(file_data);
            count = parseInt(count[0]['count']);

            disp.getTweets_count = count; 
            disp.tweetModalStyle();
        });

        $('#modal').modal();
        
        // Fill the modal
        disp.getTweets_progress = new Progress({
            parent_id: ".modal-options",
            text: "Fetching Tweets",
            full: true,
            initial: 100
        });
        
        disp.getTweets_progress.start();
        data.callPHP('tweets/get', post,
            disp.tweetModalContent, disp.tweetModalContent);
    },
    tweetModalStyle: function() {
        var offset = disp.getTweets_post.offset;
        var limit = disp.getTweets_post.limit;
        
        d3.select('.tweet_modal_count')
            .html(' ('   + (offset + 1) +  
                  ' to ' + (offset + limit) +
                  ' of ' + disp.getTweets_count + ') ');
        
        d3.selectAll('.tweet_modal_order')
            .attr('class', function(d) {
                if(d == options['Analysis']['Fetched Tweet Order'].indexCur())
                    return 'btn btn-primary tweet_modal_order';
                return 'btn btn-default tweet_modal_order';
            });
                        
        d3.selectAll('.tweet_modal_step')
            .attr('class', function(d) {
                var max = disp.getTweets_count;
                var offset = disp.getTweets_post.offset;
                var limit = disp.getTweets_post.limit;
                if((0 < offset && d < 0) ||
                   (offset + limit < max && 0 < d) )
                    return 'btn btn-primary tweet_modal_step';
                return 'btn btn-default tweet_modal_step';
            })
            .attr('disabled', function(d) {
                var max = disp.getTweets_count;
                var offset = disp.getTweets_post.offset;
                var limit = disp.getTweets_post.limit;
                if((0 < offset && d < 0) ||
                   (offset + limit < max && 0 < d) )
                    return null;
                return '';
            });
    },
    tweetModalContent: function(filedata) {
        var modal_body = d3.select('#modal .modal-body');
        modal_body.selectAll('*').remove();
        
        // Handle errors
        if(filedata.indexOf('Maximum execution time') >= 0) {
            modal_body.append('div')
                .attr('class', 'text-center')
                .html("Error retrieving tweets. <br /><br /> Query took too long");
        } else if (filedata.indexOf('Fatal error') >= 0 ||
                   filedata.indexOf('Errormessage') >= 0 ||
                   filedata.indexOf('[{') != 0) {
            modal_body.append('div')
                .attr('class', 'text-center')
                .html("Error retrieving tweets. <br /><br /> " + filedata);
        } else {
            // Otherwise, parse the data
            filedata = JSON.parse(filedata);

            if(filedata.length == 0) {
                modal_body.append('div')
                    .attr('class', 'text-center')
                    .text("No more tweets found in this selection.");
            } else {
                modal_body.append('ul')
                    .attr('class', 'list-group')
                    .selectAll('li').data(filedata).enter()
                    .append('li')
                    .attr('class', 'list-group-item')
                    .html(function(d) {
                        var content = '<span class="badge"><a href="https://twitter.com/emcomp/status/' + d['ID'] + '" target="_blank">' + d['ID'] + '</a></span>';
                        content += d['Timestamp'] + ' ';
                        content += d['Username'] + ' said: ';
                        content += "<br />";
                        content += d['Text'];
                        content += "<br />";
                        if(d['Distinct'] == '1')
                            content += 'distinct ';
                        content += d['Type'];
                        if(d['Origin'])
                            content += ' of <a href="https://twitter.com/emcomp/status/' + d['Origin'] + '" target="_blank">#' + d['Origin'] + '</a>'
                        if(d['Count'] && d['Count'] > 1)
                            content += ', ' + (d['Count'] - 1) + " repeats";
                        return content;
                    });
                
            }
        }
        
        // Update style and stop progress bar
        disp.getTweets_progress.end();
        disp.tweetModalStyle();        
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
    fadeIn: function(d3_object, display) {
        if(typeof(d3_object) == "string")
            d3_object = d3.select(d3_object);
        d3_object.transition()
            .style('opacity', 1)
            .style('display', display || 'table');
    },
    fadeOut: function(d3_object) {
        if(typeof(d3_object) == "string")
            d3_object = d3.select(d3_object);
        d3_object.transition()
            .style('opacity', 0)
            .each('end', function() {
                d3.select(this).style('display', 'none')
            });
    },
    nGramModal: function(selector) {
        var ngrams = data.ngrams.main;
        var label  = options['Analysis']['N-Gram View'].getLabel();
        if(selector == 'ngram_cmp') {
            ngrams = data.ngrams.cmp;
            label  = options['Analysis']['N-Gram Compare'].getLabel();
        }

        d3.select('#modal .modal-title')
            .html('NGrams for ' + label +
                  ' (' + ngrams.nTweets + ' tweets)');

        // Clear any data still in the modal
        d3.select('#m .modal-options')
            .selectAll('*').remove();
        d3.select('#modal .modal-options')
            .selectAll('*').remove();
        
        // Clear rare data
        ngrams.NGramCounter[0].purgeBelow(10);
        ngrams.NGramCounter[1].purgeBelow(10);
        ngrams.NGramCounter[2].purgeBelow(10);
        
        // If comparing, make new counter that's a subtraction
        // TODO

        // Report errors if they happened
        // Otherwise, parse the data

        if(false) {
            var modal_body = d3.select('#modal .modal-body');
            modal_body.selectAll('*').remove();
            modal_body.append('div')
                .attr('class', 'text-center')
                .text("No tweets found in this selection.");
        } else {
            disp.nGramModalFillNGrams(ngrams);
        }

        // Add options
        var ops = d3.select('#modal .modal-options');
        ops.selectAll('*').remove();
        
        options.makeSimpleToggle('Exclude Stopwards', '.modal-options', function(d) {
            ngrams.exclude_stopwords = d;
            disp.nGramModalFillNGrams(ngrams);
        }, ngrams.exclude_stopwords);
        options.makeSimpleToggle('Relative', '.modal-options', function(d) {
            ngrams.relative = d;
            disp.nGramModalFillNGrams(ngrams);
        }, ngrams.relative);
        
        $('#modal').modal();
    },
    nGramModalFillNGrams: function(ngrams) {
        var modal_body = d3.select('#modal .modal-body');
        modal_body.selectAll('*').remove();

        var labels = ['Unigrams', 'Bigrams', 'Trigrams'];
        var top;
        if(ngrams.exclude_stopwords) {
            top = [ngrams.NGramCounter[0].top_no_stopwords(100),
                   ngrams.NGramCounter[1].top_no_stopwords(100),
                   ngrams.NGramCounter[2].top_no_stopwords(100)];
        } else {
            top = [ngrams.NGramCounter[0].top(100),
                   ngrams.NGramCounter[1].top(100),
                   ngrams.NGramCounter[2].top(100)];
        }

        modal_body.append('table')
            .append('tr')
            .selectAll('td')
            .data(top)
            .enter()
            .append('td')
            .attr('class', 'ngram_table_container')
            .append('table')
            .attr('class', 'ngram_table')
            .each(function(d, i) {
                var header = d3.select(this).append('tr');
                header.append('th')
                    .attr('class', 'ngram_count_label')
                    .text(labels[i]);
                header.append('th')
                    .attr('class', 'ngram_count_count')
                    .text(ngrams.Relative ? 'Freq' : 'Count');

                d3.select(this)
                    .selectAll('tr.ngram_count')
                    .data(d)
                    .enter()
                    .append('tr')
                    .attr('class', 'ngram_count');
            });
        
        modal_body.selectAll('.ngram_count')
            .append('td')
            .attr('class', 'ngram_count_label')
            .text(function(d) { return d.key; });
        
        if(ngrams.relative) {
            modal_body.selectAll('.ngram_count')
                .append('td')
                .attr('class', 'ngram_count_count')
                .text(function(d) { 
                    return (d.value * 100.0 / ngrams.nTweets).toFixed(1); 
            });
        } else {
            modal_body.selectAll('.ngram_count')
                .append('td')
                .attr('class', 'ngram_count_count')
                .text(function(d) { return d.value; });
        }
    }
}