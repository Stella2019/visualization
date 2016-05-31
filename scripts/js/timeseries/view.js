function TimeseriesView(app) {
    this.app = app;
    
    this.init();
    
    this.tweets = {};
}

TimeseriesView.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('event_updated', this.setTitle.bind(this));
        $(window).on('resize', this.setChartSizes.bind(this));
        triggers.on('chart:plan resize', this.setChartSizes.bind(this));
        triggers.on('chart:context time', this.setContextTime.bind(this));
        triggers.on('chart:resolution change', this.setContextTime.bind(this));
        triggers.on('chart:focus time', this.setFocusTime.bind(this));
        triggers.on('tooltip:move', this.tooltipMove.bind(this));
        triggers.on('fetch tweets', this.fetchTweets.bind(this));
    },
    buildPage: function() {
        var body = d3.select('body')
            .append('div')
            .attr('id', 'body');
        
        body.append('div')
            .attr('class', 'header')
            .append('span')
            .attr('id', 'chart-title')
            .html('Twitter Collection Timeseries Visualization');
        
        body.append('div')
            .attr('id', 'focus-container')
            .attr('class', 'chart-container')
            .append('svg')
            .attr('id', 'focus')
            .attr('class', 'chart');
        
        body.append('div')
            .attr('id', 'context-container')
            .attr('class', 'chart-container')
            .append('svg')
            .attr('id', 'context')
            .attr('class', 'chart');
        
        body.append('div')
            .attr('class', 'ui-bottom footer')
            .append('div')
            .html('Tweet volume over the whole collection period. Brush over to focus on time.');
        
        triggers.emit('page_built');
    },
    setTitle: function(event) {
         d3.select('#chart-title')
            .html('<small>' + event.Type + ':</small> ' + 
                  event.Label);
    },
    setChartSizes: function(event) {
        // Get constraints
        var page = window.innerHeight;
        var header = parseInt(d3.select('.header').style('height'));
        var footer = parseInt(d3.select('.footer').style('height'));
        
        var focus_height_manual = this.app.ops['Axes']['Height Toggle'].is(1);
        var width_manual = this.app.ops['Axes']['Width Toggle'].is(1);
        
        // Minimum heights
        var focus_height = focus_height_manual ? parseInt(this.app.ops['Axes']['Height'].get()) : 200;
        var context_height = 120;
        var width = width_manual ? parseInt(this.app.ops['Axes']['Width'].get()) : parseInt(d3.select('.header').style('width'));
        
        // Fill extra space
        // -10 because of page margins I haven't been able to resolve
        // -30 for the padding on the top & bottom
        var extra_space = page - header - footer - focus_height - context_height - 10 - 30;
        if(extra_space > 0) {
            var extra_focus = focus_height_manual ? 0 : Math.floor(extra_space * 0.75);
            focus_height += extra_focus;
            context_height += extra_space - extra_focus;
        }
        
        // Send an event
        if(!focus_height_manual) {
            this.app.ops['Axes']['Height'].updateInInterface(focus_height);
        }
        if(!width_manual) {
            this.app.ops['Axes']['Width'].updateInInterface(width);
        }
        triggers.emit('focus:resize', [focus_height, width]);
        triggers.emit('context:resize', [context_height, width]);
    },
    buildTimeWindow: function() { // Legacy, not actually used right now
        var container = d3.select(".ui-bottom").append("div")
            .style({width: '500px', display: 'inline-table'})
            .attr("class", "text-center input-group input-group-sm");
//            .html("<strong>Time Window:</strong> ");
        
        
        var right_buttons = container.append('div')
            .attr('id', 'choices_time_right_buttons')
            .attr('class', 'input-group-btn');
        
        right_buttons.append('button')
            .attr({class: 'btn btn-default'})
            .html('<span class="glyphicon glyphicon-step-backward"></span>')
            .on('click', function(d) {
                disp.setFocusTime('button_time_to_start');
            });
//        right_buttons.append('button')
//            .attr({class: 'btn btn-default'})
//            .html('<span class="glyphicon glyphicon-backward"></span>')
//            .on('click', function(d) {
//                setFocusTime('button_time_minus_6h');
//            });
//        right_buttons.append('button')
//            .attr({class: 'btn btn-default'})
//            .html('<span class="glyphicon glyphicon-triangle-left"></span>')
//            .on('click', function(d) {
//                setFocusTime('button_time_minus_1h');
//            });
        
        container.append("input")
//            .style('width', '140px') // add 40 px for timezones
            .attr("id", "choose_lView_lTime_Min")
            .attr("class", "text-center form-control");
        container.append("span")
            .attr("class", "input-group-addon")
            .text("  to  ");
        container.append("input")
//            .style('width', '140px')
            .attr("id", "choose_lView_lTime_Max")
            .attr("class", "text-center form-control");
        
        var left_buttons = container.append('div')
            .attr('id', 'choices_time_left_buttons')
            .attr('class', 'input-group-btn');
        
//        left_buttons.append('button')
//            .attr({class: 'btn btn-default'})
//            .html('<span class="glyphicon glyphicon-triangle-right"></span>')
//            .on('click', function(d) {
//                setFocusTime('button_time_plus_1h');
//            });
//        left_buttons.append('button')
//            .attr({class: 'btn btn-default'})
//            .html('<span class="glyphicon glyphicon-forward"></span>')
//            .on('click', function(d) {
//                setFocusTime('button_time_plus_6h');
//            });
        left_buttons.append('button')
            .attr({class: 'btn btn-default'})
            .html('<span class="glyphicon glyphicon-step-forward"></span>')
            .on('click', function(d) {
                disp.setFocusTime('button_time_to_end');
            });
        
        var startDateTextBox = $('#choose_time_min');
        var endDateTextBox = $('#choose_time_max');
        
        startDateTextBox.datetimepicker({ 
            dateFormat: 'yy-mm-dd',
            timeFormat: 'HH:mm', // HH:mm z for timezone
            onClose: function(dateText, inst) {
                if (endDateTextBox.val() != '') {
                    var testStartDate = startDateTextBox.datetimepicker('getDate');
                    var testEndDate = endDateTextBox.datetimepicker('getDate');
                    if (testStartDate > testEndDate)
                        endDateTextBox.datetimepicker('setDate', testStartDate);
                } else {
                    endDateTextBox.val(dateText);
                }
            },
            onSelect: function (selectedDateTime){
                var date = startDateTextBox.datetimepicker('getDate');
                endDateTextBox.datetimepicker('option', 'minDate', date);
                endDateTextBox.datetimepicker('option', 'minDate', date);
                options.time_min.set(date);
                
                options.time_min.callback();
            }
        });
        endDateTextBox.datetimepicker({
            dateFormat: 'yy-mm-dd',
            timeFormat: 'HH:mm',
            onClose: function(dateText, inst) {
                if (startDateTextBox.val() != '') {
                    var testStartDate = startDateTextBox.datetimepicker('getDate');
                    var testEndDate = endDateTextBox.datetimepicker('getDate');
                    if (testStartDate > testEndDate)
                        startDateTextBox.datetimepicker('setDate', testEndDate);
                } else {
                    startDateTextBox.val(dateText);
                }
            },
            onSelect: function (selectedDateTime){
                var date = endDateTextBox.datetimepicker('getDate');
                endDateTextBox.datetimepicker('option', 'maxDate', date);
                options.time_max.set(date);
                
                options.time_max.callback();
            }
        });
        
//        d3.selectAll('#ui-datepicker-div button').classed('btn btn-default', true);
    },
    setContextTime: function() {
        // Establish the maximum and minimum time of the data series
        var time_min = this.app.model.time.min;
        var time_max = this.app.model.time.max;
        var time_min_op = this.app.ops['View']['Time Min'];
        var time_max_op = this.app.ops['View']['Time Max'];
        var startTime = time_min_op.get();
        var endTime = time_max_op.get();
        if(startTime) {
            if(typeof(startTime) == 'string')
                startTime = new Date(startTime);
        } else {
            startTime = new Date(time_min);
        }
        if(endTime) {
            if(typeof(endTime) == 'string')
                endTime = new Date(startTime);
        } else {
            endTime = new Date(time_max);
        }

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
        this.app.context.x.domain([time_min, time_max]);
        this.app.focus.x.domain(this.app.context.brush.empty() ? [startTime, endTime] : this.app.context.brush.extent());

        // Initialize the brush if it isn't identical
        if(startTime > time_min || endTime < time_max) {
            this.app.context.brush.extent([startTime, endTime]);
        }

        // Set the time option
        time_min_op.set(startTime);
        time_min_op.min = new Date(time_min);
        time_max_op.set(endTime);
        time_max_op.max = new Date(time_max);
        
        triggers.emit('chart:plan resize');
        triggers.emit('chart:focus time');
    },
    setFocusTime: function (origin) {
        var time_min_op = this.app.ops['View']['Time Min'];
        var time_max_op = this.app.ops['View']['Time Max'];
        var startTime, endTime;
        var brushEvent = false;
        
        // Get the start/end times
        if(origin == 'brush') {
            var times = this.app.context.brush.extent();
            startTime = times[0];
            endTime   = times[1];
            brushEvent = true;
        } else {
            startTime = time_min_op.get();
            endTime = time_max_op.get();
        }
    
        // Bound the start and end times
        if(startTime < time_min_op.min)
            startTime = new Date(time_min_op.min);
        if(endTime > time_max_op.max)
            endTime = new Date(time_max_op.max);
        if(startTime >= endTime ) {
            startTime = new Date(time_min_op.min);
            endTime = new Date(time_max_op.max);
        }
        
        time_min_op.set(startTime);
        time_max_op.set(endTime);
        
        if(startTime > time_min_op.min || endTime < time_max_op.max) {    
            if(!brushEvent) {
                // Update the brush
                this.app.context.brush.extent([startTime, endTime])
                this.app.context.brush(d3.select(".brush").transition());
                this.app.context.brush.event(d3.select(".brush").transition());
            }
        } else {
            d3.selectAll(".brush").call(this.app.context.brush.clear());//brush.clear();
        }
        
        this.app.ops.recordState();
        
        // Trigger focus
        triggers.emit('focus:time_window', 
                      this.app.context.brush.empty() ?
                      this.app.context.x.domain() :
                      this.app.context.brush.extent());
    },
    tooltipMove: function(xy) {
        this.app.tooltip.move(xy[0], xy[1]);
    },
    fetchTweets: function(args) {
        var post = {
            collection: args.collection,
            collection_id: args[args.collection + '_id'],
            extradata: 'u',
        };
        
        if(args['tweet_min']) { // Bound tweets in time
            post['tweet_min'] = args['tweet_min'];
            post['tweet_max'] = args['tweet_max'];
        } else if(args['time_min']) {
            post['tweet_min'] = util.timestamp2TwitterID(args['time_min']);
            post['tweet_max'] = util.timestamp2TwitterID(args['time_max']);
        }
        
        var order = this.app.ops['Analysis']['Fetched Tweet Order'].get();
        if(order == "rand") {
            post.rand = true;
        } else if(order == "prevalence") {
            post.order_prevalence = true;
        }
        
        // Options not considered yet:
        /* Distinct
           Tweet Type
           Limit
           CSV */
        
        var title = 'Tweets in ' + args.label +
                ' between <br />' + util.formatDate(args.time_min) + 
                ' and ' + util.formatDate(args.time_max); // handle if there is no time min/max
        
        this.buildTweetsModal(post, title);
    },
    buildTweetsModal: function(post, title) {        
        // Reset the modal & get the title
        triggers.emit('modal:reset');
        triggers.emit('modal:title', title +
                      '<span class="tweet_modal_count"></span>');
        
        // Save the data for fetching more later
        post.offset = 0;
        post.limit = 5;
        this.tweets = {
            post: post,
            count: 0,
            modal: {
                body: this.app.modal.body,
                options: this.app.modal.options,
                order: [],
                steps: [],
                count: d3.select('.tweet_modal_count'),
            },
            op_order: this.app.ops['Analysis']['Fetched Tweet Order'],
            progress: new Progress({
                parent_id: ".modal-options",
                text: "Fetching Tweets",
                full: true,
                initial: 100
            }),
        }
        
        // Add options
        this.buildTweetModalOptions();
        
        triggers.emit('modal:open');
        
        // Fill the modal
        this.tweets.progress.start();
        this.app.connection.php('tweets/get', post,
            this.fillTweetModalContent.bind(this));
    },
    buildTweetModalOptions: function() {
        var order_div = this.tweets.modal.options.append('div')
            .attr('class', 'btn-group')
            .style('margin-bottom', '0px');

        order_div.append('span')
            .attr('class', 'btn btn-default')
            .attr('disabled', '')
            .text('Order by:');

        this.tweets.modal.order = order_div.selectAll('button.tweet_modal_order')
            .data(this.tweets.op_order.available)
            .enter()
            .append('button')
            .attr('class', 'btn tweet_modal_order')
            .text(function(d) {
                return this.tweets.op_order.labels[d];
            }.bind(this))
            .on('click', function(d) {
                this.tweets.op_order.click(d);
                var order = this.tweets.op_order.get();

                var post = this.tweets.post;
                if(order == 'rand') {
                    post.rand = true;
                    delete post.order_prevalence;
                } else if(order == 'prevalence') {
                    post.order_prevalence = true;
                    delete post.rand;
                } else {
                    delete post.order_prevalence;
                    delete post.rand;
                }

                // Fetch new data
                this.tweets.progress.start();
                this.app.connection.php('tweets/get', post,
                    this.fillTweetModalContent.bind(this));
            }.bind(this));

        this.tweets.modal.steps = this.tweets.modal.options.append('div')
            .attr('class', 'btn-group')
            .style('margin-bottom', '0px')
            .selectAll('button.tweet_modal_step')
            .data([-10000, -5, 5])
            .enter()
            .append('button')
            .attr('class', 'btn btn-primary tweet_modal_step')
            .on('click', function(d) {
                this.tweets.post.offset = Math.max(this.tweets.post.offset + d, 0);
                this.styleTweetModal();

                // Fetch new data
                this.tweets.progress.start();
                this.app.connection.php('tweets/get',
                    this.tweets.post,
                    this.fillTweetModalContent.bind(this));
            }.bind(this));
        
        this.tweets.modal.steps.append('span')
            .attr('class', function(d) {
                var symbol = 'step-backward';
                if(d == -5)
                    symbol = 'chevron-left';
                if(d == 5)
                    symbol = 'chevron-right';
            
                return 'glyphicon glyphicon-' + symbol;
            });
    },
    styleTweetModal: function() {
        var offset = this.tweets.post.offset;
        var limit = this.tweets.limit;
        
        this.tweets.modal.count
            .html(' ('   + (offset + 1) +  
                  ' to ' + Math.min(offset + limit, this.tweets.count) +
                  ' of ' + this.tweets.count + ') ');
        
        this.tweets.modal.order
            .attr('class', function(d) {
                if(d == this.tweets.op_order.indexCur())
                    return 'btn btn-primary tweet_modal_order';
                return 'btn btn-default tweet_modal_order';
            }.bind(this));
                        
        this.tweets.modal.steps
            .attr('class', function(d) {
                var max    = this.tweets.count;
                var offset = this.tweets.post.offset;
                var limit  = this.tweets.post.limit;
                if((0 < offset && d < 0) ||
                   (offset + limit < max && 0 < d) )
                    return 'btn btn-primary tweet_modal_step';
                return 'btn btn-default tweet_modal_step';
            }.bind(this))
            .attr('disabled', function(d) {
//                var max    = this.tweets.count;
//                var offset = this.tweets.post.offset;
//                var limit  = this.tweets.post.limit;
//                if((0 < offset && d < 0) ||
//                   (offset + limit < max && 0 < d) )
//                    return null;
//                return ''; // TODO impose limits
                return null;
            }.bind(this));
    },
    fillTweetModalContent: function(filedata) {
        var modal_body = this.tweets.modal.body;
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
                        content += d['Username'] + '(@' + d['Screenname'] + ') said: ';
                        content += "<br />";
                        content += d['Text'];
                        content += "<br />";
                        if(d['Distinct'] == '1')
                            content += 'distinct ';
                        content += d['Type'];
                        if(d['ParentID'])
                            content += ' of <a href="https://twitter.com/emcomp/status/' + d['ParentID'] + '" target="_blank">#' + d['ParentID'] + '</a>'
                        if(d['ExpandedURL'])
                            content += ' <a href="' + d['ExpandedURL'] + '" target="_blank">link</a>'
                        if(d['Count'] && d['Count'] > 1)
                            content += ', ' + (d['Count'] - 1) + " repeats";
                        return content;
                    });
                
            }
        }
        
        // Update style and stop progress bar
        this.tweets.progress.end();
        this.styleTweetModal();
    },
}