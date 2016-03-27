global_min_id = 0;
global_max_id = 1e20;

var util = {
    formatDate: d3.time.format("%Y-%m-%d %H:%M:%S"),
    formDate: function(d) { return util.formatDate(new Date(new Date(new Date(d).setSeconds(0)).setMilliseconds(0))).replace(' ', 'T'); },
    date2monthstr: d3.time.format("%Y-%m"),
    date: function(str) {
        return util.formatDate.parse(str);
    },
    simplify: function(str) {
        return "l" + str.replace(/\W/g, '_');
    },
    compareCollections: function(a, b) {
        return util.compareDates(new Date(a.StartTime), new Date(b.StartTime));
    },
    compareSeries: function(a, b) {
        if(a.sum !== undefined && b.sum !== undefined)
            return b.sum - a.sum;
        return a.order - b.order;
    },
    compareDates: function(a, b) {
        if(a < b) 
            return -1;
        if(a > b)
            return 1;
        return 0;
    },
    lunique: function(list) {
        return Array.from(new Set(list)).sort();
    },
    range: function(length) {
        var arr = [];
        for(var i = 0; i < length; i++) {
            arr.push(i);
        }
        return arr;
    },
    zeros: function(length, width) { // just initialize a 1D or 2D matrix filled with zeros like in Matlab
        if(!width) {
            return d3.range(length).map(function() { return 0; });
        } else {
            return d3.range(length).map(function() { 
                return d3.range(width).map(function() { return 0; });
            });
        }
    },
    lshift: function(num, bits) {
        return num * Math.pow(2, bits);
    },
    rshift: function(num, bits) {
        return num / Math.pow(2, bits);
    },
    twitterID2Timestamp: function(ID) {
        return new Date(util.rshift(ID, 22) + 1288834974657);
    },
    timestamp2TwitterID: function(date) {
        return util.lshift(date.getTime() - 1288834974657, 22);
    }
}

function Counter() {
    this.counts = new d3.map();
}
Counter.prototype = {
    has: function(key) {
        return this.counts.get(key) || false;
    },
    set: function(key, val) {
        this.counts.set(key, val);
    },
    incr: function(key, add) {
        add = add || 1;
        var val = this.counts.get(key) || 0;
        this.counts.set(key, val + add);
    },
    cmpCount: function(a, b) {
        if(a.value == b.value)
            return a.key.localeCompare(b.key);
        return b.value - a.value
    },
    top: function(k) {
        return this.top_nlogn(k);
    },
    top_nk: function(k) { // O(nk)
        k = k || 10; // default 10
        
        var top = d3.range(k).map(function() {
            return {key: "", value: 0};
        })
        var minVal = 0;
        var moreThanMin = 0;
        this.counts.forEach(function(key, val) {
            // If it is bigger than a candidate
            if(minVal < val) {
                if(moreThanMin >= k - 1)
                    top = top.filter(function(d) { return d.value > minVal});
                top.push({
                    key: key,
                    value: val
                });
                minVal = d3.min(top, function(d) { return d.value});
                moreThanMin = top.filter(function(d) { return d.value > minVal}).length;
            } else if(minVal == val) {
                top.push({
                    key: key,
                    value: val
                });
            }
        });
        
        return this.firstK(this.getSorted(top), k)
    },
    top_nlogn: function(k) { // O(nlogn)
        k |= 10; // default 10
        
        return this.firstK(this.getSorted(), k);
    },
    stopwords: ['the', 'a', 'an', 'that', 'this',
                'rt', 
                'in', 'on', 'to', 'of', 'at', 'for', 'with', 'about',
                'is', 'are', 'be', 'was', 'have', 'has',
                'i', 'you', 'he', 'she', 'it', 'we', 'they',
                'me', 'him', 'her', 'us', 'them', 
                'my', 'your', 'his', 'its', 'our', 'their',
                'and', 'or',
                'as', 'if', 'so'],
    top_no_stopwords: function(k) {
        k |= 10; // default 10
        var stopwords = this.stopwords;
        
        var entries = this.counts.entries().filter(function(d) {
            return !d.key.split(' ').reduce(function(found, word) {
                return found || stopwords.includes(word);
            }, false);
        }, this);
        return this.firstK(this.getSorted(entries), k)
    },
    getSorted: function(arr) {
        if(!arr)
            arr = this.counts.entries();
        arr.sort(this.cmpCount)
        return arr;
    },
    firstK: function(arr, k) {
        if(!arr)
            arr = this.counts.entries();
        k |= 10; // default 10
        k = Math.min(k, arr.length);
        
        var res = [];
        for(var i = 0; i < k; i++)
            res.push(arr[i]);
        return res;
    },
    purgeBelow: function(minimum, add_rare) { 
        if(minimum) {
            var self = this;
            this.counts.forEach(function(key, val) {
                if(val < minimum) {
                    this.remove(key);
                    if(add_rare)
                        self.incr("_rare_", val);
                }
            });
        } else { // Halves the size of the array
            var sorted = this.getSorted();
            minimum = sorted[sorted.length / 2].value + 1;

            sorted.forEach(function(entry) {
                if(entry.value < minimum) {
                    this.counts.remove(entry.key);
                    if(add_rare)
                        this.incr("_rare_", entry.value);
                }
            }, this);
        }
    }
};

function Connection(args) {
    var self = this;
    var permitted_args = ['name', 'url', 'post', 'time_res',
                          'progress_div', 'progress_button', 'progress_text', 'progress_button',
                          'id_min', 'id_max',
                          'failure_msg',
                          'on_chunk_finish', 'on_finish']

    // Save args  
    if(args) {
        Object.keys(args).forEach(function (item) {
            if(item in permitted_args) {
                this[item] = args[item];
            }
        }, this);
    }
    
    // Defaults
    self.name            = self.name            || 'r' + Math.floor(Math.random() * 1000000 + 1);
    self.url             = self.url             || "";
    self.post            = self.post            || {};
    self.time_res        = self.time_res        || 1; // 1 Hour
    
    self.progress        = {};
    self.progress_div    = self.progress_div    || '#timeseries_div';
    self.progress_text   = self.progress_text   || "Working";
    self.progress_button = self.progress_button || false;
    
    self.id_chunks       = [];
    self.chunk_index     = 0;
    self.id_min          = self.id_min          || global_min_id; // TODO
    self.id_max          = self.id_max          || global_max_id; // TODO
    
    self.failure_msg     = self.failure_msg     || 'Problem with data stream';
    self.on_chunk_finish = self.on_chunk_finish || function () {};
    self.on_finish       = self.on_finish       || function () {};
    
}
Connection.prototype = {
    php: function(url, fields, callback, error_callback) {
        if(!fields)
            fields = {};
        if(!callback)
            callback = function() {};
        if(!error_callback)
            error_callback = function() {};
        
        $.ajax({
            url: 'scripts/php/' + url + '.php',
            type: "POST",
            data: fields,
            cache: false,
            success: callback,
            error: error_callback
        });
    },
    startStream: function () {
        this.id_chunks = [];
        this.chunk_index = 0;
        for(var id = this.id_min; id < this.id_max;
            id += this.time_res * 60 * 60 * 1000) {
            this.id_chunks.push(id);
        }
        this.id_chunks.push(this.id_max);

        // Start progress bar
        this.progress = new Progress({
            name:      this.name,
            parent_id: this.progress_div,
            full:      this.progress_button,
            text:      this.progress_text,
            steps:     this.id_chunks.length - 1
        });
        this.progress.start();

        this.startChunk();
    },
    startChunk: function () {
        // If we are at the max, end
        if (this.chunk_index >= this.id_chunks.length - 1) {
            // Load the new data
            this.on_finish();

            // End the progress bar and stop function
            this.progress.end();
            return;
        } else if(this.chunk_index < 0) {
            // End prematurely
            this.progress.end();
            return;
        }

        this.post.id_min = this.id_chunks[this.chunk_index];
        this.post.id_max = this.id_chunks[this.chunk_index + 1];

        this.php(this.url, this.post,
                     this.chunk_success.bind(this),
                     this.chunk_failure.bind(this));
    },
    chunk_success: function (file_data) {
        if (file_data.includes('<b>Notice</b>')) {
            console.debug(file_data);

            // Abort
            this.chunk_failure();
            return;
        }

        // Update the progress bar
        this.progress.update(this.chunk_index + 1, this.progress_text);

        this.on_chunk_finish(file_data);

        // Start loading the next batch
        this.chunk_index = this.chunk_index + 1;
        this.startChunk();
    },
    chunk_failure: function (a, b, c) {
        console.log(a, b, c);
        disp.alert(this.failure_msg);
        this.progress.end();
    },
    stop: function() {
        this.chunk_index = -100;
    }
};

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
                .html(function(d) { 
                    if(Array.isArray(new_data[d]))
                        return new_data[d].join(', ');
                    return new_data[d];
                });
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
    },
    attach: function(id, data_transform) {
        d3.select(id)
            .on('mouseover', function(d) {
                this.setData(data_transform(d))
                this.on();
            }.bind(this))
            .on('mousemove', function(d) {
                this.move(d3.event.x, d3.event.y);
            }.bind(this))
            .on('mouseout', function(d) {
                this.off();
            }.bind(this));
    }
};

triggers = {
    events: {},
    on: function (eventName, fn) {
        this.events[eventName] = this.events[eventName] || [];
        this.events[eventName].push(fn);
    },
    off: function(eventName, fn) {
        if (this.events[eventName]) {
            for (var i = 0; i < this.events[eventName].length; i++) {
                if (this.events[eventName][i] === fn) {
                    this.events[eventName].splice(i, 1);
                    break;
                }
            };
        }
    },
    emit: function (eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(function(fn) {
                fn(data);
            });
        }
    },
    emitter: function(eventName) {
        return function(d) { this.emit(eventName, d); }.bind(this);
    }
};
