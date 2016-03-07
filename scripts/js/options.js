function Option(args) {
    Object.keys(args).map(function (item) {
        this[item] = args[item];
    }, this);
    
    this.cur = this.ids[this.default];
    if(!this.available) {
        this.available = d3.range(this.ids.length);
    }
}
Option.prototype = {
    get: function () { return this.cur; },
    getLabel: function () { return this.labels[this.indexCur()]; },
    set: function (choice) {
        if (this.has(choice))
            this.cur = choice;
    },
    is: function (choice) { return this.cur == choice; },
    has: function (choice) {
        return this.custom_entries_allowed || this.indexOf(choice) > -1;
    },
    indexOf: function (choice) { return this.ids.indexOf(choice); },
    indexCur: function () { return this.indexOf(this.cur); }
};

function Options() {
    var self = this;
    
    self.timefields = ['time_min', 'time_max'];
    self.state = {};
};
Options.prototype = {
    init: function() {
        
        // Build options
//            options.buildTopMenu();
//            options.buildTimeWindow();
        options.buildSidebar();
        
        // Import the current state
        options.importState();
        window.onpopstate = function() {
            options.importState()
        };
        
        // Style elements
        $(function () {
            $('[data-toggle="popover"]').popover()
        })
        
        // Record the state
        options.recordState(true);
    },
    importState: function() {
        var state;
        try {
//            state = JSON.parse(window.location.hash.slice(1));
//            console.debug(state);
            var uristate = decodeURIComponent(window.location.hash);
            var strstate = uristate.slice(1);
            if(strstate.length <= 0)
                return;
            state = JSON.parse(strstate);
        } catch(err) {
            console.log(err);
            return;
        }
        
        // Figure out what options should be different
        var changed = [];
        Object.keys(state).forEach(function(panel_name) {
            var panel = options[panel_name];
            var panel_state = state[panel_name];
            
            Object.keys(panel_state).forEach(function(option_name) {
                var option = panel[option_name];
                if(!option) return;
                var option_value = panel_state[option_name];
//                console.log(panel_name, panel_state, panel);
//                console.log(option_name, option_value, option);
                option.set(option_value);
                changed.push(option_name);
                
                d3.select("#choose_" + panel_name + "_" + option_name).select('.current')
                    .text(option.getLabel());
            });
        });
//        Object.keys(state).forEach(function(option) {
//            if(["time_min", "time_max"].indexOf(option) > -1) {
//                if(options.time_save.is("false"))
//                    return;
//                
//                value = new Date(value);
//            } else if(option in options && options[option].isnumeric) {
//                value = parseInt(value) || value;
//            }
//            
//            if(option in options && !options[option].is(value)) {
//                // Record this change
//                console.info("Import option " + option + 
//                            ": from [" + options[option].get() + "]" +
//                            " to [" + value + "]");
//                changed.push(option);
//                
//                // Change the state entry
//                options[option].set(value);
//                
//                // Change the interface
//                if(options.initial_buttons.indexOf(option) > -1) {
//                    if(options[option].textfield) {
//                        options[option].update(value);
//                    } else {
//                        d3.select("#choose_" + option).select('.current')
//                            .text(options[option].getLabel());
//                    }
//                }
//            }
//        });
        
        // If the program has been initialized
        if(changed.length > 0 && data && data.all && data.all[0]) {
            // Render changes

            if(changed.indexOf("collection") > -1) {
                data.setCollection();
                
                options.collection_type.set(data.collection['Type']);

                d3.select('#choose_collection_type').select('.current')
                    .text(options.collection_type.getLabel());

                options.recordState(true);

                options.chooseCollectionType();
            } else {
                pipeline.start('Find Which Data is Shown'); // although we can do something else
            }
        } else if (changed.length > 0 && location.pathname.includes('coding.html')) {
            options['Dataset']['Rumor'].callback();
        }
    },
    recordState: function(override) {
        var state = {};
        options.panels.forEach(function(panel_name) {
            state[panel_name] = {};
            var panel = options[panel_name];
            Object.keys(panel).forEach(function(option_name) {
                state[panel_name][option_name] = panel[option_name].get();
            });
        });
        strstate = '#' + JSON.stringify(state);
        
        if(override) {
            history.replaceState(null, null, strstate);
        } else {
            history.pushState(null, null, strstate);
        }
    },
    togglePane: function() {
        var show = options.show_options.is("true");
        
        d3.select('#choices')
            .transition(1000)
            .style({'max-height': show ? '150px' : '0px',
                    'opacity': show ? 1 : 0});
    },
    buildButtonSet: function(option) {
        var set = options[option];
        
        var container = d3.select(set.parent).append("div")
            .attr("class", "choice")
            .style("text-transform", "capitalize")
            .html(" " + set.title + ": ")
            .append("div")
                .attr("id", superId)
                .attr("class", "btn-group");
        
//        container.append("button")
//            .attr({type: "button",
//                class: 'btn btn-sm btn-default'})
//            .style({'font-weight': 'bold'})
//            .text(set.title);
        
        container.selectAll("button")
            .data(set.available)
            .enter()
            .append("button")
                .attr("type", "button")
                .attr("class", "btn btn-sm btn-default")
                .attr("id", function(d) { return set.ids[d]; })
                .text(function(d) { return set.labels[d]; })
                .on("click", function(d) {
                    container.select('.active').classed('active', false);
                    container.select('#' + set.ids[d]).classed('active', true);

                    set.set(set.ids[d]);

                    set.callback();
                });

        container.select('#' + set.ids[set.default]).classed('active', true);
    },
    buildTopMenu: function() {
        d3.select('#choices')
            .selectAll('div')
            .data(options.choice_groups)
            .enter()
            .append('div')
            .attr('id', function(d) { return 'choices_' + d; });
        
        options.initial_buttons.map(function(option) {
            if(options[option].type == 'textfieldautoman') {
                options.buildTextToggle(option);
            } else if(options[option].type == 'textfieldconfirm') {
                options.buildTextConfirm(option);
            } else if(options[option].type == 'toggle') {
                options.buildToggle(option);
            } else { // Dropdown
                options.buildDropdown(option);
            }
        });
    },
    makeSimpleToggle: function(label, parent, callback, initial) {
        if(initial == undefined)
            initial = true;
        
        var style = function(element) {
            d3.select(element)
                .attr('class', function(d) {
                     return 'btn btn-' + (d ? 'primary' : 'default');
                })
                .select('span')
                .attr('class', function(d) {
                     return 'glyphicon glyphicon-' + (d ? 'ok-circle' : 'ban-circle');
                })
        };
        
        d3.select(parent).append('button')
            .data([initial])
            .attr('id', 'toggle_' + util.simplify(label))
            .on('click', function(d) {
                d3.select(this).data([!d]);
                style(this);
                callback(!d);
            })
            .html("<span></span> " + label);
        
        style('#toggle_' + util.simplify(label));
    },
    buildToggle: function(option) {
        var set = options[option];
        
        var superId = "choose_" + option;
        set.styleFunc = function() {
            d3.select('#' + superId + "_button")
                .attr('class', function() {
                    return set.styles[set.indexCur()];
                })
                .html(function() {
                    return set.getLabel();
                });
        }
        
        // Make container
        var container = d3.select(set.parent).append("div")
            .attr("class", "choice")
            .style("display", "inline-table")
            .style("vertical-align", "top")
            .style("text-transform", "capitalize")
            .append("div")
                .attr("id", superId)
                .attr("class", "input-group input-group-sm");
        
        container.append('button')
            .attr('id', superId + "_button")
            .on('click', function(d) {
                var toggle = !(set.get() == "true");
                set.set(toggle ? "true" : "false");
                set.styleFunc();
                options.recordState();
            
                set.callback();
            });
    },
    buildTextToggle: function(option) {
        var set = options[option];
        
        // Make container
        var superId = "choose_" + option;
        var container = d3.select(set.parent).append("div")
            .attr("class", "choice")
            .style("display", "inline-table")
            .style("vertical-align", "top")
            .style("text-transform", "capitalize")
            .append("div")
                .attr("id", superId)
                .attr("class", "input-group input-group-sm");
        
        // Add title
        container.append('span')
            .attr('class', 'input-group-addon')
            .html(set.title);
        
        // Add toggle option
        var toggleOption = option + "_toggle";
        
        options[toggleOption] = new Option({
            title: "Save " + set.title + " State",
            styles: ["btn btn-default", "btn btn-primary"],
            labels: ["Auto", "Manual"],
//            labels: ["<span class='glyphicon glyphicon-pencil'></span>", "<span class='glyphicon glyphicon-pencil'></span>"],
            tooltips: ["Click to toggle manual mode", "Click to toggle automatic mode"],
//            labels: [set.title, set.title],
//            labels: ["<span class='glyphicon glyphicon-ban-circle'></span> Auto", "<span class='glyphicon glyphicon-ok-circle'></span> Manual"],
            ids:    ["false", "true"],
            available: [0, 1],
            default: 0,
            callback: function() {
                options.recordState();
                pipeline.start('Configure Plot Area');
            },
            styleFunc: function() {
                d3.select('#input_' + option)
                    .attr('disabled', options[toggleOption].get() == "true" ? null : true);
                d3.select('#choice_' + toggleOption)
                    .attr('class', function() {
                        return options[toggleOption].styles[options[toggleOption].indexCur()];
                    })
                    .attr('data-content', function() {
                        return options[toggleOption].tooltips[options[toggleOption].indexCur()];
                    })
                    .html(function() {
                        return options[toggleOption].getLabel();
                    });
            }
        });
        
        container.append("input")
            .attr("id", "input_" + option)
            .style("width", "80px")
            .attr("class", "text-center form-control")
            .on('keyup', function(d) {
                set.set(this.value);
                options.recordState();
            
                options[option].callback();
            });
        
        container.append('div')
            .attr('class', 'input-group-btn')
            .append('button')
            .attr({
                id: 'choice_' + toggleOption,
                'data-toggle': "popover",
                'data-trigger': "hover",
                'data-placement': "bottom",
                'data-content': "Tooltip on bottom"
            })
            .on('click', function(d) {
                var saving = !(options[toggleOption].get() == "true");
                options[toggleOption].set(saving ? "true" : "false");
                options[toggleOption].styleFunc();
            
                if(saving) {
                    if(options.record.indexOf(option) == -1)
                        options.record.push(option);
                } else {
                    if(options.record.indexOf(option) > -1)
                        options.record.splice(options.record.indexOf(option), 1);
                }
            
                options[toggleOption].callback();
            });
        
        options[option].update = function(value) {
            document.getElementById("input_" + option)
                .value = value;
        };
        

        options.state[toggleOption] = options[toggleOption].get();
        options.state[option] = set.ids[set.default];
    },
    buildTextConfirm: function(option) {
        var set = options[option];
        
        // Make container
        var superId = "choose_" + option;
        var container = d3.select(set.parent).append("div")
            .attr("class", "choice")
            .style("display", "inline-table")
            .style("vertical-align", "top")
            .style("text-transform", "capitalize")
            .append("div")
                .attr("id", superId)
                .attr("class", "input-group input-group-sm");
        
        // Add title
        container.append('span')
            .attr('class', 'input-group-addon')
            .html(set.title);
        
        container.append("input")
            .attr("id", "input_" + option)
            .style("width", "120px")
            .attr("class", "text-center form-control")
            .html(set.labels[set.default])
            .on('keyup', function(d) {
                if (d3.event.keyCode == 13) {
                    options[option].callback();
                } else {
                    set.set(this.value);
                }
            });
        
        options[option].reset = function(value) {
            set.set("");
            document.getElementById("input_" + option)
                .value = "";
        };
        
        container.append('div')
            .attr('class', 'input-group-btn')
            .append('button')
            .html("<span class='glyphicon glyphicon-search'></span>")
            .attr('class', 'btn btn-primary')
            .on('click', options[option].callback);
        
        options.state[option] = set.ids[set.default];
    },
    buildDropdown: function(option) {
        
        // Select the option set
        var set = options[option];
        var superId = "choose_" + option;
        var container = d3.select('#' + superId);
        
        // If it does not exist, create it
        if(!container[0][0]) {
            container = d3.select(set.parent).append("div")
                .attr("class", "choice")
                .style("text-transform", "capitalize")
                .append("div")
                    .attr("id", superId)
                    .attr("class", "dropdown");
        }
        
        var list_open = container.select('button.dropdown-toggle')
        if(!list_open[0][0]) {
            list_open = container.append("button")
                .attr({type: "button",
                    class: 'btn btn-sm btn-primary dropdown-toggle',
                    'data-toggle': "dropdown",
                    'aria-haspopup': true,
                    'aria-expanded': false})
                .html("<strong>" + set.title + ":</strong> ");
            
            list_open.append('span')
                .attr('class', 'current')
                .style('text-transform', 'capitalize')
                .html('Label');

            list_open.append('text')
                .text(' ');
            list_open.append('span')
                .attr('class', 'caret');
        }
        
        var list = container.select('ul');
        if(!list[0][0]) {
            list = container.append('ul')
                .attr({class: 'dropdown-menu'});
        }
        
        // Populate the list;
        var elements = list.selectAll("li")
            .data(set.available);
        
        elements.enter()
            .append("li").append("a");
        
        elements.exit().remove(); // Remove former columns
        elements.select('a'); // Propagate any data that needs to be
        
        set.click = function(d) {
            container.select('.current')
                .text(set.labels[d]);

            set.set(set.ids[d]);
            options.recordState();

            set.callback();
        }
        
        list.selectAll('a')
            .attr("id", function(d) { return option + "_" + set.ids[d]; })
            .html(function(d) {
                return set.labels[d];
            })
            .on("click", set.click);

        // Save the current value to the interface and the history
        container.select('.current')
            .text(set.labels[set.default]);
        
        // Add an edit button if there is an edit function
        if('edit' in set) {
            var edit_button = container.select('button.edit-button')
            if(!edit_button[0][0]) {
                container.classed('btn-group', true);

                list_open.style({
                    'border-top-right-radius': '0px',
                    'border-bottom-right-radius': '0px',
                    'border-right': 'none'
                });

                edit_button = container.append('button')
                    .attr('class', 'btn btn-xs btn-primary edit-button')
                    .on('click', set.edit)
                    .append('span')
                    .attr('class', 'glyphicon glyphicon-pencil');
            }
        }
        // Add another button if there is one
        if('button' in set) {
            var new_button = container.select('button.new-button')
            if(!new_button[0][0]) {
                container.classed('btn-group', true);

                list_open.style({
                    'border-top-right-radius': '0px',
                    'border-bottom-right-radius': '0px',
                    'border-right': 'none'
                });

                new_button = container.append('button')
                    .attr('class', 'btn btn-sm btn-primary new-button')
                    .on('click', set.button_callback)
                    .html(set['button']);
            }
        }
        
        options.state[option] = set.ids[set.default];
    },
    buildTimeWindow: function() {
 
        var container = d3.select("#chart-bottom").append("div")
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
            .attr("id", "choose_time_min")
            .attr("class", "text-center form-control");
        container.append("span")
            .attr("class", "input-group-addon")
            .text("  to  ");
        container.append("input")
//            .style('width', '140px')
            .attr("id", "choose_time_max")
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
        
        options.time_save.styleFunc = function() {
            d3.select('#choice_time_save')
                .attr('class', function() {
                    return options.time_save.styles[options.time_save.indexCur()];
                })
                .html(function() {
                    return options.time_save.getLabel();
                });
        }
        
        left_buttons.append('button')
            .attr('id', 'choice_time_save')
            .on('click', function(d) {
                var saving = !(options.time_save.is("true"));
                options.time_save.set(saving ? "true" : "false");
                options.time_save.styleFunc();
                options.recordState();
            
                options.time_save.callback();
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
    buildCollections: function() {
        // Generate Collections List
        options.collection['labels'] = data.collection_names;
        options.collection['ids'] = data.collections.map(function(collection) { return collection['ID']; });
        options.collection['available'] = util.range(data.collections.length);
        
        // Find the current collection
        var cur = options.collection.get();
        options.collection.default = data.collections.reduce(function(candidate, collection, i) {
            if(collection['ID'] == cur)
                return i;
            return candidate;
        }, 0);
        options.collection.set(options.collection['ids'][options.collection.default]);
        
        // Make the dropdown
        options.buildDropdown('collection');
        options.recordState(true);
        
        // Generate Types of Collections
        var types = util.lunique(data.collections.map(function(collection) { return collection['Type']; }));
        types.unshift('All'); // Add 'All' to begining
        
        options.collection_type['labels'] = types;
        options.collection_type['ids'] = types;
        options.collection_type['available'] = util.range(types.length);
        
        // Set the type to match the current collection
        options.collection_type.default = options.collection_type['ids'].indexOf(
            data.collections[options.collection.default]['Type'] );
        options.collection_type.set(types[options.collection_type.default]);
        
        // Make the dropdown for collection types

        options.buildDropdown('collection_type');
        options.recordState(true);

        // Add additional information for collections
        data.collections.map(options.addCollectionPopup);
//        $('.collection_option').popover({html: true});
        
        // Limit the collection selections to the particular type
        options.chooseCollectionType();
    },
    buildRumors: function() {
        var rumor_names = data.rumors.map(function(rumor) {
            return rumor.Name;
        });
        
        // Generate Collections List
        options.rumor['labels'] = rumor_names;
        options.rumor['labels'].unshift('None');
        options.rumor['labels'].push('- New -');
        options.rumor['ids'] = data.rumors.map(function(rumor) { return rumor['ID']; });
        options.rumor['ids'].unshift('_none_');
        options.rumor['ids'].push('_new_');
        options.rumor['available'] = util.range(options.rumor['labels'].length);
        
        // Find the current collection
        var cur = options.rumor.get();
        options.rumor.default = data.rumors.reduce(function(candidate, rumor, i) {
            if(rumor['ID'] == cur)
                return i;
            return candidate;
        }, 0);
        options.rumor.set(options.rumor['ids'][options.rumor.default]);
        
        // Make the dropdown
        options.buildDropdown('rumor');
        options.recordState(true);
        
        data.setRumor();
        
        options.buildNGrams();
    },
    addCollectionPopup: function(collection) {
        var content = '<dl class="dl-horizontal collection_popover">';
        Object.keys(collection).map(function(key) {
            content += "<dt>" + key + "</dt>";

            if(collection[key] instanceof Date) {
                var date = new Date(collection[key]);
                content += "<dd>" + util.formatDate(date) + "&nbsp;</dd>";
            } else if(collection[key] instanceof Array) {
                var arr = collection[key].join(", ");
                content += "<dd>" + arr + "&nbsp;</dd>";
            } else {
                content += "<dd>" + collection[key] + "&nbsp;</dd>";
            }
        });
        content += "</dl>";

//        d3.select('#collection_' + collection['ID'])
//            .attr({
//                'class': 'collection_option',
//                'data-toggle': "popover",
//                'data-trigger': "hover",
//                'data-placement': "right",
//                'data-content': content}
//             );
//        $('#collection_' + collection['ID']).popover({html: true});
        
        disp.newPopup('#collection_' + collection['ID'])
            .set('content', content)
            .set('placement', 'right');
    },
    chooseCollectionType: function() {
        var curType = options.collection_type.get();
        var curCollection = options.collection.get();
        var firstValid = -1; 
        
        data.collections.map(function(collection, i) {
            if(collection['Type'] == curType || 'All' == curType) {
                d3.select('#collection_' + collection['ID'])
                    .style('display', 'block');
                
                if(firstValid == -1)
                    firstValid = i;
            } else {
                d3.select('#collection_' + collection['ID'])
                    .style('display', 'none');
                
                if(collection['ID'] == curCollection)
                    curCollection = 'invalid';
            }
        });
        
        // If the current collection does not match this type, then make a new one
        if(curCollection == 'invalid') {
            options.collection.set(options.collection.ids[firstValid]);
                        
            d3.select('#choose_collection').select('.current')
                .text(options.collection.getLabel());

            options.recordState(true);

            data.setCollection();
        }
            
    },
    editWindow: function(option) {
//        var set = options[option];
//        var id = set.get();
        
        var info = data[option];
        if(!info || !('ID' in info)) {
            disp.alert('No information.', 'warning');
            
            return
        }
        
        // Set Modal Title
        d3.select('#modal .modal-title')
            .html(info.DisplayName ? info.DisplayName : info.Name);

        // Clear any data still in the modal
        d3.select('#modal .modal-options')
            .selectAll('*').remove();
        var modal_body = d3.select('#modal .modal-body');
        modal_body.selectAll('*').remove();
        
        // Append form
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
        
        var keys = Object.keys(info);
        var divs = form.selectAll('div.form-group')
            .data(keys)
            .enter()
            .append('div')
            .attr('class', 'form-group');
        
        divs.append('label')
            .attr('for', function(d) { return 'edit_input_' + d; })
            .attr('class', 'col-sm-3 control-label')
            .text(function(d) {
                // Convert CamelCase to Camel Case
                if(d.includes('ID'))
                    return d.replace('_', ' ');
                else
                    return d.replace(/([A-Z])/g, " $1");
            });
        
        var nonEditable = ['Keywords', 'OldKeywords', 'Server', 'Month'];
        var identifier = ['ID', 'Event_ID'];
        if(option == 'collection')
            identifier.push('Name');
        
        var dateFields = ['StartTime', 'StopTime'];
        var textareaFields = ['Description', 'Definition'];
        var queryFields = ['Query'];
        
        divs.append('div')
            .attr('class', function(d) { 
                if(identifier.includes(d))
                    return 'col-sm-9 edit-box edit-box-id';
                else if(nonEditable.includes(d))
                    return 'col-sm-9 edit-box edit-box-static';
                else if(dateFields.includes(d))
                    return 'col-sm-9 edit-box edit-box-date';
                else if(textareaFields.includes(d))
                    return 'col-sm-9 edit-box edit-box-textarea';
                else if(queryFields.includes(d))
                    return 'col-sm-9 edit-box edit-box-query';
                else
                    return 'col-sm-9 edit-box edit-box-textfield';
            });
        
        form.selectAll('.edit-box-id')
            .append('input')
            .attr({
                class: 'form-control',
                type: 'text',
                id: function(d) { return 'edit_input_' + d; },
                name: function(d) { return d.toLowerCase(); },
                value: function(d) { return info[d]; },
                readonly: function(d) { return info[d] ? false : true; }
            });
        
        form.selectAll('.edit-box-textfield')
            .append('input')
            .attr({
                class: 'form-control',
                type: 'text',
                id: function(d) { return 'edit_input_' + d; },
                name: function(d) { return d; },
                placeholder: function(d) { return info[d]; }
            });
        
        form.selectAll('.edit-box-textarea')
            .append('textarea')
            .attr({
                class: 'form-control',
                type: 'text',
                id: function(d) { return 'edit_input_' + d; },
                name: function(d) { return d; },
                rows: 3,
                placeholder: function(d) { return info[d]; }
            });
        
        form.selectAll('.edit-box-date')
            .append('input')
            .attr({
                class: 'form-control',
                type: 'datetime-local',
                id: function(d) { return 'edit_input_' + d; },
                name: function(d) { return d; },
                value: function(d) {
                    if(info[d] instanceof Date)
                        return util.formatDate(info[d]).replace(' ', 'T');
                }
            });
        
        if(keys.includes('Query'))
            options.queryEditCreate(form, info);
        
        form.selectAll('.edit-box-static')
            .append('p')
            .attr('class', 'form-control-static')
            .text(function(d) { return info[d]; });
        
        form.append('input')
            .attr({
                name: 'type',
                value: option,
                class: 'hidden'
            });
        
        // Add Lower Buttons        
        var bottom_row = d3.select('#modal .modal-options')
        
        bottom_row.append('div')
            .append('button')
            .attr({
                id: 'edit-window-save',
                class: 'btn btn-default'
            })
            .text('Update')
            .on('click', data.updateCollection);
        
//        disp.newPopup('#edit-window-save')
//            .set('content', 'Otherwise won\'t save changes');
        
        if(option == 'rumor') {
            options.editWindowRumorOptions();
        }
        
        form.selectAll('input')
            .on('input', options.editWindowChanged);
        
        $('#modal').modal();
    },
    editWindowRumorOptions: function() {
        var bottom_row = d3.select('#modal .modal-options')
        var option = 'rumor';
        
        var tweet_count = bottom_row.append('div')
            .attr('id', 'edit-window-tweetin-div')
            .attr('class', 'input-group')
            .style('display', 'inline-table');
            
        tweet_count.append('span')
            .attr('class', 'input-group-addon')
            .text('Count:')
            .style('width', 'auto');

        tweet_count.append('input')
            .attr('id', 'edit-window-tweetin-count')
            .attr('class', 'text-center form-control')
            .attr('readonly', '')
            .style('width', '80px')
            .attr('value', 0);
        
        data.getRumorCount();

        tweet_count.append('div')
            .attr('class', 'input-group-btn')
            .style('margin', '0px')
            .append('button')
            .data([option])
            .attr({
                id: 'edit-window-tweetin',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', data.genTweetInCollection)
            .append('span')
            .attr('class', 'glyphicon glyphicon-refresh');
        
        bottom_row.append('div')
            .attr('id', 'edit-window-gencount-div')
            .append('button')
            .data([option])
            .attr({
                id: 'edit-window-gencount',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', data.rmTweetCount)
            .text('Count Tweets');
//            .append('span')
//            .attr('class', 'glyphicon glyphicon-signal');
        
//        bottom_row.append('div')
//            .attr('id', 'edit-window-gencodecount-div')
//            .append('button')
//            .data([option])
//            .attr({
//                id: 'edit-window-gencodecount',
//                class: 'btn btn-primary edit-window-routine'
//            })
//            .on('click', data.rmCodeCount)
//            .text('Count Codes');
//            .append('span')
//            .attr('class', 'glyphicon glyphicon-signal');

        bottom_row.append('div')
            .attr('id', 'edit-window-fetch100-div')
            .append('button')
            .data([option + " 100"])
            .attr({
                id: 'edit-window-fetch100',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', function() {
                data.getTweets({
                    limit: 300,
                    distinct: 1,
                    rand: '',
                    rumor_id: data.rumor.ID,
                    csv: ''
                });
            })
            .html('<span class="glyphicon glyphicon-download-alt"></span> 100 Rand');

        bottom_row.append('div')
            .attr('id', 'edit-window-fetchall-div')
            .append('button')
            .data([option + " all"])
            .attr({
                id: 'edit-window-fetchall',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', function() {
                data.getTweets({
                    limit: 10000,
                    distinct: 1,
                    rumor_id: data.rumor.ID,
                    csv: ''
                });
            })
            .html('<span class="glyphicon glyphicon-download-alt"></span> All');
    },
    editWindowChanged: function() {
        // Indicate that the collection is to be updated
        d3.select('#edit-window-save')
            .attr('class', 'btn btn-primary');
        
        // Disable Match/Fetch buttons
        d3.selectAll('.edit-window-routine')
            .attr('disabled', '');
    },
    editWindowUpdated: function() {
        // Reload the rumor list
        options.updateCollectionCallback();
        
        // Turn update to normal
        d3.select('#edit-window-save')
            .attr('class', 'btn btn-default');

        // Unlock Match/Fetch buttons
        d3.selectAll('.edit-window-routine')
            .attr('disabled', null);
    },
    queryEditCreate: function(form, info) {
        var queryarea = form.select('.edit-box-query');
        var querybox = queryarea.append('table');
        
//        console.log(info);
        var rows = querybox.selectAll('tr.edit-box-query-and')
            .data(function(d) { 
                var query = info[d] || '';
                return query.split(','); 
            })
            .enter()
            .append('tr')
            .attr('class', 'edit-box-query-and');

        // Add all current AND statements
        rows.append('td')
            .style('vertical-align', 'top')
            .append('select')
            .attr('class', 'form-control input-sm selectType')
            .on('change', function() {}) // nothing for now
            .selectAll('option')
            .data(['In Text'])
            .enter()
            .append('option')
            .text(function(d) { return d; });

        // Add place to make new row
//        querybox.append('tr')
//            .attr('id', 'query-edit-add')
//            .append('td')
        queryarea.append('button')
            .attr('class', 'btn btn-sm btn-primary')
            .style('margin', '3px')
            .append('span')
            .attr('class', 'glyphicon glyphicon-plus')
            .on('click', options.queryEditAddRow);

        // Add terms for each row
        var terms = rows.append('td');

        terms.selectAll('input.edit-box-query-or')
            .data(function(d) { 
                var arr = d.split('|');
                    arr.push(""); // append empty one
                return arr; })
            .enter()
            .append('input')
            .attr({
                class: 'edit-box-query-or form-control input-sm',
                type: 'text',
                size: '10',
                value: function(d) {
                    var str =   d.replace('[[:<:]]', '\\W');
                    var str = str.replace('[[:>:]]', '\\W');
                    return str;
                },
                placeholder: 'new'
            })
            .on('focus', options.queryEditFocus)
            .on('blur', options.queryEditBlur);


        querybox.selectAll('td')
            .style({
                padding: '3px'
            });
        querybox.selectAll('input')
            .style({
                width: 'auto',
                display: 'inline-block'
            });

        form.append('input')
            .attr({
                id: 'edit-box-query-input',
                name: 'Query',
                class: 'hidden'
            });
    },
    queryEditFocus: function() {
        options.queryEditCheckEmpties(d3.select(this.parentElement));
    },
    queryEditBlur: function() {
        options.queryEditCheckEmpties(d3.select(this.parentElement), true);
        
        options.queryEditForm();
    },
    queryEditCheckEmpties: function(parent, blurring) {
        var empties = [];
        var inputs = parent.selectAll("input");
        
        inputs[0].forEach(function(element) {
            if(!element.value)  {
                empties.push(element);
            }
        });
        
        // If the container only has empties, delete it's parent
        if(blurring && empties.length == inputs[0].length) {
            d3.select(parent[0][0].parentNode).remove();
            return;
        }

        // Otherwise, appropriately trim/add empty elements
        if(empties.length == 0) {
            parent.append('input')
                .attr({
                    class: 'edit-box-query-or form-control input-sm',
                    type: 'text',
                    size: '10',
                    placeholder: 'new'
                })
                .style({
                    width: 'auto',
                    display: 'inline-block'
                })
                .on('focus', options.queryEditFocus)
                .on('blur', options.queryEditBlur)
                .on('input', options.editWindowChanged);
            
        } else if(empties.length > 1) {
            // Remove all but the last
            for (var i = 0; i < empties.length - 1; i++) {
                d3.select(empties[i]).remove();
            }
        }
    },
    queryEditAddRow: function() {
        var querybox = d3.select('.edit-box-query table')
        
        var row = querybox.append('tr')
            .attr('class', 'edit-box-query-and');

        // Add all current AND statements
        row.append('td')
            .style('vertical-align', 'top')
            .append('select')
            .attr('class', 'form-control input-sm selectType')
            .on('change', function() {}) // nothing for now
            .selectAll('option')
            .data(['In Text'])
            .enter()
            .append('option')
            .text(function(d) { return d; });
        
        options.queryEditCheckEmpties(row.append('td'));
    },
    queryEditForm: function() {
        var rows = d3.selectAll('.edit-box-query .edit-box-query-and');
        
        var and_terms = rows[0].reduce(function(and_terms, row) {
            var inputs = d3.select(row).selectAll('input');
            
            var or_terms = inputs[0].reduce(function(or_terms, element) {
                if(element.value) {
                    var val = element.value;
                    val = val.replace(/\\W(.*)\\W/g, "[[:<:]]$1[[:>:]]");
                    
                    or_terms.push(val);
                }
                return or_terms;
            }, []);
            
            if(or_terms)
                and_terms.push(or_terms.join('|'));
            return and_terms;
        }, []);
        
        console.log(and_terms.join(','));
        document.getElementById('edit-box-query-input')
            .value = and_terms.join(',');
    },
    buildNGrams: function() {
        var labels = ['Whole Event'];
        var ids = ['e_event'];
        
        // Add rumors
        var rumor_labels = options.rumor['labels']
            .slice(0, -1).forEach(function(d) {
            labels.push('R: ' + d);
        });
        var rumor_ids = options.rumor['ids'].slice(0, -1)
            .forEach(function(d) {
            ids.push('r_' + d);
        });
        
        // Add keywords
        if(data && data.cats && data.cats['Keyword'] && data.cats['Keyword'].series_arr.length > 1) {
            data.cats['Keyword'].series_arr.forEach(function(series) {
                if(series.name != '_total_') {
                    labels.push('K: ' + series.display_name);
                    ids.push('k_' + series.id);
                }
            });
        }
        
        // Make view options
        options.ngram_view.labels = labels;
        options.ngram_view.ids = ids;
        options.ngram_view.available = d3.range(ids.length);
        options.buildDropdown('ngram_view');
        
        // Make compare options
        labels = labels.map(function(d) { return d; });
        ids = ids.map(function(d) { return d; });
        labels.unshift('-');
        ids.unshift('');
        
        options.ngram_cmp.labels = labels;
        options.ngram_cmp.ids = ids;
        options.ngram_cmp.available = d3.range(ids.length);
        options.buildDropdown('ngram_cmp');
        
    },
    configureLoadTimeWindow: function() {
        var window = options.load_time_window.get();
        
        if(window == '1d') {
            options.load_time_min.date = new Date(data.time.collection_min);
            options.load_time_max.date = new Date(data.time.collection_min);
            options.load_time_max.date.setHours(options.load_time_max.date.getHours() + 24);
        } else if(window == '3d') {
            options.load_time_min.date = new Date(data.time.collection_min);
            options.load_time_max.date = new Date(data.time.collection_min);
            options.load_time_max.date.setHours(options.load_time_max.date.getHours() + 24 * 3);
        } else if(window == 'all') {
            options.load_time_min.date = new Date(data.time.collection_min);
            options.load_time_max.date = new Date(data.time.collection_max);
        } else { // Custom
//            data.time.selected_min = new Date(options.data_time.custom_min);
//            data.time.selected_max = new Date(options.data_time.custom_max);
        }
        
        // Outer Bounds
        if(options.load_time_min.date < data.time.collection_min) {
            options.load_time_min.date = new Date(data.time.collection_min);
        }
        if(options.load_time_max.date > data.time.collection_max) {
            options.load_time_max.date = new Date(data.time.collection_max);
        }
        // Inner Bound
        if(options.load_time_max.date < options.load_time_min.date) {
            options.load_time_max.date = new Date(options.load_time_min.date);
        }
            
        // Set Text Fields
        options.load_time_min.set(util.formDate(options.load_time_min.date));
        options.load_time_max.set(util.formDate(options.load_time_max.date));
        options.recordState(false);
        
    },
    editLoadTimeWindow: function() {
        options.load_time_min.custom = new Date(options.load_time_min.date);
        options.load_time_max.custom = new Date(options.load_time_max.date);
        
        // Set Modal Title
        d3.select('#modal .modal-title')
            .html('Set Time Window');

        // Clear any data still in the modal
        d3.select('#modal .modal-options')
            .selectAll('*').remove();
        var modal_body = d3.select('#modal .modal-body');
        modal_body.selectAll('*').remove();
        
        // Append form
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
                    time: options.load_time_min.custom,
                    min: data.time.collection_min,
                    max: data.time.collection_max
                },{
                    label: 'To',
                    time: options.load_time_max.custom,
                    min: data.time.collection_min,
                    max: data.time.collection_max
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
                if(d.label == 'From') {
                    options.load_time_min.custom = new Date(data.time.collection_min);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(options.load_time_min.custom);
                } else { // To
                    options.load_time_max.custom = new Date(options.load_time_min.custom);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(options.load_time_max.custom);
                }
            });
        
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
                var date = new Date(document.getElementById('edit_load_time_' + d.label).value);
                date.setHours(date.getHours() + 8);
                if(d.label == 'From') {
                    options.load_time_min.custom = date;
                } else { // To
                    options.load_time_max.custom = date;
                }
            });
        
        entries.append('div')
            .attr('class', 'input-group-btn')
            .append('button')
            .attr('class', 'btn btn-default')
            .html('<span class="glyphicon glyphicon-step-forward"></span>')
            .on('click', function(d) {
                if(d.label == 'From') {
                    options.load_time_min.custom = new Date(options.load_time_max.custom);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(options.load_time_min.custom);
                } else { // To
                    options.load_time_max.custom = new Date(data.time.collection_max);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(options.load_time_max.custom);
                }
            });
        
        // Accept Button
        var ops = d3.select('#modal .modal-options')
        ops.selectAll('*').remove();
        
        ops.append('button')
            .attr({
//                id: 'edit-window-tweetin',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', function(d) {
                // Set values
                options.load_time_window.set('custom');
                options.load_time_min.date = options.load_time_min.custom;
                options.load_time_max.date = options.load_time_max.custom;
                
                // Close modal
                $('#modal').modal(false);
                
                // Functions
                options.configureLoadTimeWindow();
                data.loadCollectionData(); 
            })
            .text('Update');
        
        
        $('#modal').modal(true);
    },
    buildSidebar: function() {
        var sidebar = d3.select('body').append('div')
            .attr('class', 'sidebar');
        
        // Pages
        var pages_panel = sidebar.append('div')
            .attr('id', 'panel_pages')
            .attr('class', 'sidepanel');
        
        pages_panel.append('h4')
            .html('Pages')
        
        var pages = [{
            label: "Overview",
            url: "status.html"
        },{
            label: "Timeseries",
            url: "index.html"
        },{
            label: "Coding",
            url: "coding.html"
        }]
            
        pages_panel.append('ul')
            .style({
                'list-style-type': 'none',
                'padding-left': '20px'
            })
            .selectAll('li')
            .data(pages)
            .enter()
            .append('li')
            .style('list-style-type', 'none')
            .append('a')
            .attr('href', function(d) { return d.url; })
            .attr('target', '_blank')
            .html(function(d) { return d.label; });
        
        pages_panel.append('div')
            .attr('class', 'section-title')
            .html('Pages')
        
        // Add all other sidebar items
        if(!options.panels) return;
        
        options.panels.forEach(function(panel_name) {
            var panel_div = sidebar.append('div')
                .attr('id', 'panel_' + util.simplify(panel_name))
                .attr('class', 'sidepanel');

            panel_div.append('h4')
                .html(panel_name);

            var panel = options[panel_name];
            Object.keys(panel).forEach(function(option_name) {
                options.buildSidebarOption(panel_name, option_name);
            })
            
            panel_div.append('div')
                .attr('class', 'section-title')
                .html(panel_name);
        });
    },
    buildSidebarOption: function(panel_name, option_name) {
        var panel, option;
        try {
            panel = options[panel_name];
            option = panel[option_name];
        } catch(e) {
            console.log('Option ' + option_name + ' does not exist');
            return;
        }
//        console.log(panel, option);
        
        // Make containers
        var container = d3.select('#choose_' + panel_name + '_' + option_name);
        
        // If it does not exist, create it
        if(!container[0][0]) {
            container = d3.select('#panel_' + util.simplify(panel_name)).append("div")
                .attr("class", "choice")
                .style("text-transform", "capitalize")
                .append("div")
                    .attr("id", "choose_" + panel_name + '_' + option_name)
                    .attr("class", "dropdown");
        }
        
        var list_open = container.select('button.dropdown-toggle')
        if(!list_open[0][0]) {
            container.append('div')
                .html(option.title)
                .style('display', 'inline-block')
                .style('margin-left', '5px')
                .style('margin-right', '5px');
            
            list_open = container.append("button")
                .attr({type: "button",
                    class: 'btn btn-xs btn-default dropdown-toggle',
                    'data-toggle': "dropdown",
                    'aria-haspopup': true,
                    'aria-expanded': false})
                .style('float', 'none');
            
            list_open.append('span')
                .attr('class', 'current')
                .style('text-transform', 'capitalize')
                .html('Label');

            list_open.append('text')
                .text(' ');
            list_open.append('span')
                .attr('class', 'caret');
        }
        
        var list = container.select('ul');
        if(!list[0][0]) {
            list = container.append('ul')
                .style({
                    'margin-left': '20px',
                    'min-width': '0px'
                })
                .attr({class: 'dropdown-menu'});
        }
        
        // Populate the list;
        var elements = list.selectAll("li")
            .data(option.available);
        
        elements.enter()
            .append("li").append("a");
        
        elements.exit().remove(); // Remove former columns
        elements.select('a'); // Propagate any data that needs to be
        
        option.updateInInterface = function(d) {
            container.select('.current')
                .text(option.labels[d]);

            option.set(option.ids[d]);
            options.recordState();
        }
        option.updateInInterface_id = function(d) {
            option.updateInInterface(option.indexOf(d));
        }
        option.click = function(d) {
            option.updateInInterface(d);

            option.callback();
        }
        
        list.selectAll('a')
            .attr("id", function(d) { return option_name + "_" + option.ids[d]; })
            .html(function(d) {
                return option.labels[d];
            })
            .on("click", option.click);

        // Save the current value to the interface and the history
        container.select('.current')
            .text(option.labels[option.default]);
        
        // Add an edit button if there is an edit function
        if('edit' in option) {
            var edit_button = container.select('button.edit-button')
            if(!edit_button[0][0]) {
                container.classed('btn-group', true);

                list_open.style({
                    'border-top-right-radius': '0px',
                    'border-bottom-right-radius': '0px',
                    'border-right': 'none'
                });

                edit_button = container.append('button')
                    .attr('class', 'btn btn-xs btn-default edit-button')
                    .on('click', option.edit)
                    .style('float', 'none')
                    .append('span')
                    .attr('class', 'glyphicon glyphicon-pencil');
            }
        }
        
        // Make it invisible if it is hidden
        if(option.hidden) {
            container.style('display', 'none');
        }
    }
}
