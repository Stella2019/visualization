function Option(args) {
    Object.keys(args).map(function (item) {
        this[item] = args[item];
    }, this);
    
    if(!('render' in this))
        this.render = true;
    if(!this.available) {
        this.available = d3.range(this.ids.length);
    }
    if(!('default' in this))
        this.default = this.available[0];
    this.cur = this.ids[this.default];
    
    if(!('callback' in this))
        this.callback = function() {};
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

function Options(app) {
    this.app = app;
    
    this.timefields = ['time_min', 'time_max'];
    this.state = {};
    this.toggle_objects = [];
};
Options.prototype = {
    init: function() {
        this.setTriggers();
        
        // Build options
        this.buildSidebar();
        
        // Import the current state
        this.importState();
        window.onpopstate = function() {
            this.importState();
        }.bind(this);
        
        // Style elements
        this.toggle_objects.forEach(d => { d.style(); });
        
        // Record the state
        this.recordState(true);
    },
    setTriggers: function() {
//        triggers.on('edit_window:open', this.editWindow.bind(this));
//        triggers.on('edit_window:updated', this.editWindowUpdated.bind(this));
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
            if(!(panel_name in this)) {
                console.log('Option panel specified in URLf does not exist: ' + panel_name);
                return;
            }
            
            var panel = this[panel_name];
            var panel_state = state[panel_name];
            
            Object.keys(panel_state).forEach(function(option_name) {
                var option = panel[option_name];
                if(!option) return;
                var option_value = panel_state[option_name];
//                console.log(panel_name, panel_state, panel);
//                console.log(option_name, option_value, option);
                option.set(option_value);
                changed.push(panel_name + '__' + option_name);
                
                d3.select("#choose_" + util.simplify(panel_name) + "_" + util.simplify(option_name)).select('.current')
                    .html(option.getLabel());
            });
        }.bind(this));
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
        if(changed.length > 0) { //&& data && data.all && data.all[0]
            // Render changes
            return; // TODO

            if(changed.includes('event')) {
                data.setCollection();
                
                options['Dataset']['Event Type'].set(data.collection['Type']);

                d3.select('#choose_Dataset_Event_Type').select('.current')
                    .text(options['Dataset']['Event Type'].getLabel());

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
        this.panels.forEach(function(panel_name) {
            state[panel_name] = {};
            var panel = this[panel_name];
            Object.keys(panel).forEach(function(option_name) {
                state[panel_name][option_name] = panel[option_name].get();
            });
        }, this);
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
            .attr("class", "choice choice-inline-table")
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
    buildTextToggle: function(panel_name, option_name) {
        var ops = this;
        var option = ops[panel_name][option_name];
        var choice_name = util.simplify(panel_name) + '_' + util.simplify(option_name);
        
        // Override allow custom entries
        option.custom_entries_allowed = true;
        
        // Set container
        var container = d3.select('#choose_' + choice_name);
        if(!container[0][0]) {
            container = d3.select('#panel_' + util.simplify(panel_name)).append("div")
                .attr("class", "choice choice-inline-table")
                .append("div")
                    .attr("id", "choose_" + choice_name)
                    .attr("class", "input-group input-group-xs");
        }
        
        // Add label
        container.selectAll('div.sidebar-label')
            .data([option.title])
            .enter().append('div')
            .attr('class', 'sidebar-label');
        container.select('div.sidebar-label')
            .html(function(d) { return d; })
            .style('display', 'inline-block')
            .style('margin-left', '5px')
            .style('margin-right', '5px');
        
//        container.append('span')
//            .attr('class', 'input-group-addon')
//            .html(option.title);
        
        // Add toggle option        
        var op_toggle = new Option({
            title: "Save " + option.title + " State",
            labels: ["Auto", "Man"],
            tooltips: ["Click to toggle manual mode", "Click to toggle automatic mode"],
            ids:    [0, 1],
            available: [0, 1],
            default: 0,
            callback: function() {
                ops.recordState();
                
                option.callback();
            }
        });
        this.toggle_objects.push(op_toggle);
            
        op_toggle['style'] = function() {
            d3.select('#input_' + choice_name)
                .attr('disabled', this.get() ? null : true);
            d3.select('#choice_' + choice_name + '_toggle')
                .attr('class', 'btn btn-xs btn-default')
                .attr('data-content', this.tooltips[this.indexCur()])
                .html(this.getLabel());
        }.bind(op_toggle);
        
        ops[panel_name][option_name + " Toggle"] = op_toggle;
        
        container.append("input")
            .attr("id", "input_" + choice_name)
            .attr("type", 'number')
            .style("width", "80px")
            .style("float", "right")
            .style("padding", "0px")
            .attr("class", "text-center form-control input-xs")
            .on('keyup', function(d) {
                option.set(this.value);
                ops.recordState(true);
            
                option.callback();
            });
        
        container.append('div')
            .attr('class', 'input-group-btn')
            .append('button')
            .attr({
                id: 'choice_' + choice_name + '_toggle',
                'data-toggle': "popover",
                'data-trigger': "hover",
                'data-placement': "bottom",
                'data-content': "Tooltip on bottom"
            })
            .on('click', function(d) {
                op_toggle.set(1 - op_toggle.get());
                op_toggle.style();
            
                op_toggle.callback();
            });
        
        option.updateInInterface = function(d) {
            document.getElementById("input_" + choice_name)
                .value = d;

            option.set(d);
            ops.recordState(true);
        };
    },
    buildTextConfirm: function(option) {
        var set = options[option];
        
        // Make container
        var superId = "choose_" + option;
        var container = d3.select(set.parent).append("div")
            .attr("class", "choice choice-inline-table")
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
        var rumor_labels = options['Dataset']['Rumor']['labels']
            .slice(0, -1).forEach(function(d) {
            labels.push('R: ' + d);
        });
        var rumor_ids = options['Dataset']['Rumor']['ids'].slice(0, -1)
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
        options['Analysis']['N-Gram View'].labels = labels;
        options['Analysis']['N-Gram View'].ids = ids;
        options['Analysis']['N-Gram View'].available = d3.range(ids.length);
        options.buildSidebarOption('Analysis', 'N-Gram View');
        
        // Make compare options
        labels = labels.map(function(d) { return d; });
        ids = ids.map(function(d) { return d; });
        labels.unshift('-');
        ids.unshift('');
        
        options['Analysis']['N-Gram Compare'].labels = labels;
        options['Analysis']['N-Gram Compare'].ids = ids;
        options['Analysis']['N-Gram Compare'].available = d3.range(ids.length);
        options.buildSidebarOption('Analysis', 'N-Gram Compare');
        
    },
    buildSidebar: function() {
        this.sidebar = d3.select('body').append('div')
            .attr('class', 'sidebar sidebar-pinned');
        
        // Pin or Autohide
        var pin_style = function(element) {
            d3.select(element)
                .attr('class', function(d) {
                     return 'btn btn-xs ' + (d ? 'btn-default' : '');
                })
                .select('span')
                .attr('class', function(d) {
                     return 'glyphicon glyphicon-pushpin';// + (d ? 'ok-circle' : 'ban-circle');
                })
        };
        
        this.sidebar.append('button')
            .data([false])
            .attr({
                id: 'toggle_sidebar',
                class: 'btn btn-xs btn-default'
            })
            .style({
                float: 'right',
                'z-index': 20
            })
            .on('click', function(d) {
                d3.select(this).data([!d]);
                pin_style(this);
            
                d3.select('.sidebar').classed('sidebar-pinned', d);
            })
            .html("<span></span>"); // Can also incldue label
        pin_style('#toggle_sidebar');
        
        // Pages
        var pages_panel = this.sidebar.append('div')
            .attr('id', 'panel_lPages')
            .attr('class', 'sidepanel');
        
        pages_panel.append('h4')
            .data(['Pages'])
            .html(d => d + ' <span class="menu-open-icon"></span>')
            .on('click', d => {
                var pane = d3.select('#panel_' + util.simplify(d));
                pane.classed('closed', !pane.classed('closed'));
            });
        
        var pages = [{
            label: "Index",
            url: "index.html"
        },{
            label: "Datasets",
            url: "dataset_table.html"
        },{
            label: "Timeseries",
            url: "timeseries.html"
        },{
            label: "Annotated Tweets",
            url: "annotated_tweets.html"
        },{
            label: "Features",
            url: "features.html"
        },{
            label: "Laboratory",
            url: "http://misinfo.somelab.net/"
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
        
//        pages_panel.append('div')
//            .attr('class', 'section-title')
//            .html('Pages')
        
        // Add all other sidebar items
        if(!this.panels) return;
        
        this.panels.forEach(function(panel_name) {
            var panel_div = this.sidebar.append('div')
                .data([panel_name])
                .attr('id', d => 'panel_' + util.simplify(d))
                .attr('class', 'sidepanel');

            panel_div.append('h4')
                .html(d => d + ' <span class="menu-open-icon"></span>')
                .on('click', d => {
                    var pane = d3.select('#panel_' + util.simplify(d));
                    pane.classed('closed', !pane.classed('closed'));
                });

            var panel = this[panel_name];
            Object.keys(panel).forEach(function(option_name) {
                this.buildSidebarOption(panel_name, option_name);
            }, this)
            
//            panel_div.append('div')
//                .attr('class', 'section-title')
//                .html(panel_name);
        }, this);
    },
    buildSidebarOption: function(panel_name, option_name) {
        var panel, option;
        try {
            panel = this[panel_name];
            option = panel[option_name];
        } catch(e) {
            console.log('Option ' + option_name + ' does not exist');
            return;
        }
        
        // Rendering alternatives
        if(!option.render) return;
        if(option.type && option.type == 'textfieldautoman') {
            this.buildTextToggle(panel_name, option_name);
            return;
        } else if(option.type && option.type == 'dropdown_autocomplete') {
            this.buildDropdownAutocomplete(panel_name, option_name);
            return;
        }
        
        // Make containers
        var container = d3.select('#choose_' + util.simplify(panel_name) + '_' + util.simplify(option_name));
        
        // If it does not exist, create it
        if(!container[0][0]) {
            container = d3.select('#panel_' + util.simplify(panel_name)).append("div")
                .attr("class", "choice" + (option.breakbefore ? ' choice-break-before' : ''))
                .style("display", option.hidden ? 'none' : null)
                .append("div")
                    .attr("id", "choose_" + util.simplify(panel_name) + '_' + util.simplify(option_name))
                    .attr("class", "dropdown");
        }
        
        var list_open = container.select('button.dropdown-toggle')
        if(!list_open[0][0]) {
            container.append('div')
                .attr('class', 'option-label')
                .html(option.title);
            
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
                        .style('float', 'right')
                        .append('span')
                        .attr('class', 'glyphicon glyphicon-pencil');
                }
            }
            
            // Add list opener
            list_open = container.append("button")
                .attr({type: "button",
                    class: 'btn btn-xs btn-default dropdown-toggle',
                    'data-toggle': "dropdown",
                    'aria-haspopup': true,
                    'aria-expanded': false});
//                .style('float', 'none');
            
            list_open.append('span')
                .attr('class', 'current')
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
                    right: '0px',
                    left: 'auto',
                    'max-width': '100%',
                    'min-width': '0%',
                    cursor: 'pointer'
                })
                .attr({class: 'dropdown-menu'});
        }
        
        // Populate the list;
        var elements = list.selectAll("li")
            .data(option.available);
        
        elements.enter()
            .append("li")
            .attr('class', 'sidebar-dropdown-option')
            .append("a");
        
        elements.exit().remove(); // Remove former columns
        elements.select('a'); // Propagate any data that needs to be
        
        option.updateInInterface = function(d) {
            container.select('.current')
                .html(option.labels[d]);

            option.set(option.ids[d]);
            this.recordState();
        }.bind(this);
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
            .html(option.labels[option.default]);
    },
    buildDropdownAutocomplete: function(panel_name, option_name) {
        var panel = this[panel_name];
        var option = panel[option_name];
                
        // Make containers
        var container = d3.select('#choose_' + util.simplify(panel_name) + '_' + util.simplify(option_name));
        
        // If it does not exist, create it
        if(!container[0][0]) {
            container = d3.select('#panel_' + util.simplify(panel_name)).append("div")
                .attr("class", "choice" + (option.breakbefore ? ' choice-break-before' : ''))
                .style("display", option.hidden ? 'none' : 'inline-block')
                .append("div")
                    .attr("id", "choose_" + util.simplify(panel_name) + '_' + util.simplify(option_name))
                    .attr("class", "form-group");
        }
        
        var list_open = container.select('label.option-label');
        if(!list_open[0][0]) {
            container.append('label')
                .attr('class', 'option-label') //col-xs-3 control-label
                .style('font-weight', 'normal')
                .html(option.title);
            
//            // Add an edit button if there is an edit function
//            if('edit' in option) {
//                var edit_button = container.select('button.edit-button')
//                if(!edit_button[0][0]) {
//                    container.classed('btn-group', true);
//
//                    list_open.style({
//                        'border-top-right-radius': '0px',
//                        'border-bottom-right-radius': '0px',
//                        'border-right': 'none'
//                    });
//
//                    edit_button = container.append('button')
//                        .attr('class', 'btn btn-xs btn-default edit-button')
//                        .on('click', option.edit)
//                        .style('float', 'right')
//                        .append('span')
//                        .attr('class', 'glyphicon glyphicon-pencil');
//                }
//            }
        }
        
        var choices = option.available.map(function(i) {
            var entry = {
                id: option.ids[i],
                label: option.labels[i],
                name: option.labels[i].replace(/<[^>]*>/g, ''),
                index: i
            };
            return entry;
        })
        var first_choices = choices.filter(function(d) {return d < 3;}).map(function(d) { return d.name });
        
        var listname = 'typeahead-' + util.simplify(panel_name + '_' + option_name);
        var list = container.select('#' + listname);
//        option.jq_list = $('#' + listname);/
        if(!list[0][0]) {
            list = container.append('input')
                .style({
                    right: '0px',
                    left: 'auto',
                    'max-width': '100%',
                    'min-width': '0%',
                    cursor: 'pointer'
                })
                .attr({
                    type: 'text',
                    'data-provide': 'typeahead',
                    id: listname,
                    placeholder: 'Enter search' // option_name
                });
            
            option.bh_choices = new Bloodhound({
                datumTokenizer: function (data) {
                    return data.name.split(/[\W_]*/g);
                },
                queryTokenizer: function (data) {
                    return data.split(/[\W_]*/g);
                },
                local: choices,
            });
            
            option.bh_choices.initialize();
            
            // Initialize Autocompleting Input
            $('#' + listname).typeahead({
                hint: false,
                highlight: true,
                minLength: 0
            }, {
                name: listname,
                limit: 100,
                displayKey: 'name',
                source: function (q, sync) {
                    if (q === '') {
                        sync(option.bh_choices.all());
                    } else {
                        option.bh_choices.search(q, sync);
                    }
                },
                matcher: function(item) {
                    return this.query == '' || item.indexOf(this.query) >= 0;
                },
                templates: {
                    empty: '<div class="tt-suggestion"><em>No Match</em></div>',
                    suggestion: function(d) {
                        return '<div class="tt-suggestion">' + d.label + '</div>'; 
                    }
                }
            });
            
            // Add happening on select
            $('#' + listname).bind('typeahead:selected', function(ev, suggestion) {
                option.set(suggestion.id);
                this.recordState();
                option.callback();
            }.bind(this));
            
            // Add toggle button
//            container.select('.twitter-typeahead')
//                .append('span')
//                .attr('class', 'input-group-btn')
//                .style({
//                    position: 'absolute',
//                    right: '0px',
//                    top: '0px',
//                    width: '30px',
//                })
//                .append('button')
//                .attr('class', 'btn btn-sm dropdown-toggle')
//                .style({
//                    height: '26px',
//                    'line-height': 1
//                })
//                .on('click', function() {
//                    $('#' + listname).focus(); // Can also get val('')
//                })
//                .append('span')
//                .attr('class', 'caret')
//                .html('');
        } else {
            // Change the choices
            option.bh_choices.clear();
            option.bh_choices.local = choices;
            option.bh_choices.initialize(true);
            $('#' + listname).val('');
        }
        
        // Populate the list
//        var elements = list.selectAll("li")
//            .data(option.available);
        
//        elements.enter()
//            .append("li")
//            .attr('data-value', function(d) { return option.ids[d]; })
//            .html(function(d) { return option.labels[d]; });
////            .attr('class', 'sidebar-dropdown-option')
////            .append("a");
//        
//        elements.exit().remove(); // Remove former columns
//        elements.select('li'); // Propagate any data that refreshs to be
//        $('#' + listname).append($('').val(1).html('Hello'));
//            
//        $('#' + listname).data('combobox').refresh();
        
//        container.select('#' + listname)
//            .on('selected', function(d) { console.log('selected', d); })
//            .on('select', function(d) { console.log('select', d); })
//            .on('change', function(d) { console.log('change', d); });
        
//        option.updateInInterface = function(d) {
//            container.select('.current')
//                .html(option.labels[d]);
//
//            option.set(option.ids[d]);
//            this.recordState();
//        }.bind(this);
//        option.updateInInterface_id = function(d) {
//            option.updateInInterface(option.indexOf(d));
//        }
//        option.click = function(d) {
//            option.updateInInterface(d);
//
//            option.callback();
//        }
//        
//        list.selectAll('a')
//            .attr("id", function(d) { return option_name + "_" + option.ids[d]; })
//            .html(function(d) {
//                return option.labels[d];
//            })
//            .on("click", option.click);
//
//        // Save the current value to the interface and the history
//        container.select('.current')
//            .html(option.labels[option.default]);
    }
}
