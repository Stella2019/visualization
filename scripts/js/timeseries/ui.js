function TimeseriesUI(app) {
    this.app = app;
    
    this.init();
}

TimeseriesUI.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on("new_events", this.populateEventOptions.bind(this));
        triggers.on("new_event_type", this.chooseEventType.bind(this));
        triggers.on('global_time_set', this.configureLoadTimeWindow.bind(this));
        triggers.on('edit:time_window', this.editLoadTimeWindow.bind(this));
        triggers.on('choose:time_window', function() {
            if(this.app.ops['Dataset']['Time Window'].is('custom')) {
                triggers.emit('edit:time_window');
            } else {
                triggers.emit('global_time_set');
                triggers.emit('event:load_timeseries');
            }
        }.bind(this));
    },
    populateEventOptions: function() {
        var event_op = this.app.ops['Dataset']['Event'];
        var event_type_op = this.app.ops['Dataset']['Event Type'];
        
        // Generate Collections List
        event_op['labels'] = this.app.model.event_names;
        event_op['ids'] = this.app.model.events_arr.map(function(event) { return event['ID']; });
        event_op['available'] = util.range(this.app.model.events_arr.length);
        
        // Find the current collection
        var cur = event_op.get();
        event_op.default = this.app.model.events_arr.reduce(function(candidate, event, i) {
            if(event['ID'] == cur)
                return i;
            return candidate;
        }, 0);
        event_op.set(event_op['ids'][event_op.default]);
        
        // Make the dropdown
        this.app.ops.buildSidebarOption('Dataset', 'Event');
        this.app.ops.recordState(true);
        triggers.emit('new_event', this.app.model.event);
        
        // Generate Types of Collections
        var types = util.lunique(this.app.model.events_arr.map(function(event) { return event['Type']; }));
        types.unshift('All'); // Add 'All' to begining
        
        event_type_op['labels'] = types;
        event_type_op['ids'] = types;
        event_type_op['available'] = util.range(types.length);
        
        // Set the type to match the current collection
        event_type_op.default = event_type_op['ids'].indexOf(this.app.model.events_arr[event_op.default]['Type']);
        event_type_op.set(types[event_type_op.default]);
        
        // Make the dropdown for collection types
        this.app.ops.buildSidebarOption('Dataset', 'Event Type');
        this.app.ops.recordState(true);

        // Add additional information for collections
        this.app.model.events_arr.forEach(function(event) {
            var id = '#Event_' + event['ID'];
            this.app.tooltip.attach(id, function(d) {
                var event = this.app.model.events_arr[d];
                event = JSON.parse(JSON.stringify(event));
                
                ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(quantity) {
                    event[quantity + ' <small>(Distinct)</small>'] = util.formatThousands(event[quantity]);
                    if(event['Distinct' + quantity]) {
                        event[quantity + ' <small>(Distinct)</small>'] += 
                            ' <small style="left: 200px; position: absolute">(' +
                            util.formatThousands(event['Distinct' + quantity]) + ')</small>'; 
                    }
                    delete event[quantity];
                    delete event['Distinct' + quantity];
                });
                
                return event;
            }.bind(this));
        }, this);
        
        // Limit the collection selections to the particular type
        this.chooseEventType();
    },
    chooseEventType: function() {
        var event_op = this.app.ops['Dataset']['Event'];
        var curType = this.app.ops['Dataset']['Event Type'].get();
        var curEvent = event_op.get();
        var firstValid = -1; 
        
        this.app.model.events_arr.map(function(event, i) {
            if(event['Type'] == curType || 'All' == curType) {
                d3.select('#Event_' + event['ID'])
                    .style('display', 'block');
                
                if(firstValid == -1)
                    firstValid = i;
            } else {
                d3.select('#Event_' + event['ID'])
                    .style('display', 'none');
                
                if(event['ID'] == curEvent)
                    curEvent = 'invalid';
            }
        });
        
        // If the current collection does not match this type, then make a new one
        if(curEvent == 'invalid') {
            event_op.set(event_op.ids[firstValid]);
                        
            d3.select('#choose_Event').select('.current')
                .text(event_op.getLabel());

            this.app.ops.recordState(true);

            triggers.emit("new_event");
        }
    },
    configureLoadTimeWindow: function() {
        var window = this.app.ops['Dataset']['Time Window'].get();
        var time_min_op = this.app.ops['Dataset']['Time Min'];
        var time_max_op = this.app.ops['Dataset']['Time Max'];
        var time_obj = this.app.model.time;
        
        if(window == '1d') {
            time_min_op.date = new Date(time_obj.event_min);
            time_max_op.date = new Date(time_obj.event_min);
            time_max_op.date.setHours(time_max_op.date.getHours() + 24);
        } else if(window == '3d') {
            time_min_op.date = new Date(time_obj.event_min);
            time_max_op.date = new Date(time_obj.event_min);
            time_max_op.date.setHours(time_max_op.date.getHours() + 24 * 3);
        } else if(window == 'all') {
            time_min_op.date = new Date(time_obj.event_min);
            time_max_op.date = new Date(time_obj.event_max);
        } else { // Custom
//            time_obj.selected_min = new Date(options.data_time.custom_min);
//            time_obj.selected_max = new Date(options.data_time.custom_max);
        }
        
        // Outer Bounds
        if(time_min_op.date < time_obj.event_min) {
            time_min_op.date = new Date(time_obj.event_min);
        }
        if(time_max_op.date > time_obj.event_max) {
            time_max_op.date = new Date(time_obj.event_max);
        }
        // Inner Bound
        if(time_max_op.date < time_min_op.date) {
            time_max_op.date = new Date(time_min_op.date);
        }
            
        // Set Text Fields
        time_min_op.set(util.formDate(time_min_op.date));
        time_max_op.set(util.formDate(time_max_op.date));
        this.app.ops.recordState(false);
    },
    editLoadTimeWindow: function() {
        var op_time_min = this.app.ops['Dataset']['Time Min'];
        var op_time_max = this.app.ops['Dataset']['Time Max'];
        var time_obj = this.app.model.time;
        
        op_time_min.custom = new Date(op_time_min.date);
        op_time_max.custom = new Date(op_time_max.date);
        
        // Set Modal Title
        triggers.emit('modal:reset');
        triggers.emit('modal:title', 'Set Time Window');
        
        // Append form
        var modal_body = this.app.modal.body;
        var form = modal_body.append('form')
            .attr({
                id: 'edit_form',
                method: 'post',
                class: 'form-horizontal'
            })
            .on('submit', function() {
                event.preventDefault();
                return false; 
            });
        
        var divs = form.selectAll('div.form-group')
            .data([{
                    label: 'From',
                    time: op_time_min.custom,
                    min: time_obj.event_min,
                    max: time_obj.event_max
                },{
                    label: 'To',
                    time: op_time_max.custom,
                    min: time_obj.event_min,
                    max: time_obj.event_max
                }])
            .enter()
            .append('div')
            .attr('class', 'form-group');
        
        divs.append('label')
            .attr('for', function(d) { return 'edit_load_time_' + d.label; })
            .attr('class', 'col-sm-3 control-label')
            .text(function(d) { return d.label });
        
        var entries = divs.append('div')
            .attr('class', 'col-sm-9 edit-box edit-box-date input-group')
            .style('width', '1px');
        
        entries.append('div')
            .attr('class', 'input-group-btn')
            .append('button')
            .attr('class', 'btn btn-default')
            .html('<span class="glyphicon glyphicon-step-backward"></span>')
            .on('click', function(d) {
                var ops_dataset = this.app.ops['Dataset'];
                if(d.label == 'From') {
                    ops_dataset['Time Min'].custom = new Date(this.app.model.time.event_min);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(ops_dataset['Time Min'].custom);
                } else { // To
                    ops_dataset['Time Max'].custom = new Date(ops_dataset['Time Min'].custom);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(ops_dataset['Time Max'].custom);
                }
            }.bind(this));
        
        entries.append('input')
            .attr({
                class: 'form-control',
                type: 'datetime-local',
                id: function(d) { return 'edit_load_time_' + d.label; },
                value: function(d) { return util.formDate(d.time); },
                min: function(d) { return util.formDate(d.min); },
                max: function(d) { return util.formDate(d.max); }
            })
            .on('change', function(d) {
                var ops_dataset = this.app.ops['Dataset'];
                var date = new Date(document.getElementById('edit_load_time_' + d.label).value);
                date.setHours(date.getHours() + 8);
                if(d.label == 'From') {
                    ops_dataset['Time Min'].custom = date;
                } else { // To
                    ops_dataset['Time Max'].custom = date;
                }
            }.bind(this));
        
        entries.append('div')
            .attr('class', 'input-group-btn')
            .append('button')
            .attr('class', 'btn btn-default')
            .html('<span class="glyphicon glyphicon-step-forward"></span>')
            .on('click', function(d) {
                var ops_dataset = this.app.ops['Dataset'];
                if(d.label == 'From') {
                    ops_dataset['Time Min'].custom = new Date(ops_dataset['Time Max'].custom);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(ops_dataset['Time Min'].custom);
                } else { // To
                    ops_dataset['Time Max'].custom = new Date(this.app.model.time.event_max);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(ops_dataset['Time Max'].custom);
                }
            }.bind(this));
        
        // Accept Button
        var ops = this.app.modal.options;
        ops.selectAll('*').remove();
        
        ops.append('button')
            .attr({
//                id: 'edit-window-tweetin',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', function(d) {
                var ops_dataset = this.app.ops['Dataset'];
                // Set values
                ops_dataset['Time Window'].set('custom');
                ops_dataset['Time Min'].date = ops_dataset['Time Min'].custom;
                ops_dataset['Time Max'].date = ops_dataset['Time Max'].custom;
                
                // Close modal
                $('#modal').modal(false);
                
                // Functions
                triggers.emit('global_time_set');
                triggers.emit('event:load_timeseries'); // TODO
            }.bind(this))
            .text('Update');
        
        triggers.emit('modal:open');
    },
};