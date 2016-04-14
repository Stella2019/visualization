var FD;

function FeatureDistribution() {
    this.connection = new Connection();
    this.ops = new Options(this);
    this.modal = new Modal(this);
    this.tooltip = new Tooltip();
    this.dataset = new CollectionManager(this, {
        name: 'Dataset', 
        flag_subset_menu: true,
        flag_secondary_event: true
    });
//    this.cmp = new CollectionManager(this, {name: 'Comparison', flag_subset_menu: true, flag_allow_edits: false});
    
    this.data = {};
    
//    this.counters = {
//        Text: {
//            'title': 'Stripped Text',
//        }
//    }
//    this.counters_arr = Object.keys(counters).map(function(key) { return this.counters[key]; }, this);

    this.counters = ['Text', 'TextStripped', 'TextUnigrams', 'TextBigrams', 'TextTrigrams', 'TextCooccur', 'ExpandedURL', 'ExpandedURL Domain', 'MediaURL', 'Lang', 'Timestamp', 'Type', 'Distinct', 'Source', 'ParentID', 'UserID', 'Username', 'Screenname', 'UserCreatedAt', 'UserDescription', 'UserLocation', 'UserUTCOffset', 'UserTimezone', 'UserLang', 'UserStatusesCount', 'UserFollowersCount', 'UserFriendsCount', 'UserListedCount', 'UserFavouritesCount', 'UserVerified'];
    this.simpleFeatures = ['Text', 'TextStripped', 'Lang', 'Type', 'Distinct', 'Source', 'ParentID', 'UserID', 'Username', 'Screenname', 'UserDescription', 'UserLocation', 'UserUTCOffset', 'UserTimezone', 'UserLang',  'UserVerified'];
    this.timeFeatures = ['Timestamp', 'UserCreatedAt'];
    this.linkFeatures = ['ExpandedURL', 'ExpandedURL Domain', 'MediaURL'];
    this.quantityFeatures = ['UserStatusesCount', 'UserFollowersCount', 'UserFriendsCount', 'UserListedCount', 'UserFavouritesCount'];
    
    this.userFeatures = []
    
    // Page Objects
    this.body = [];
}
FeatureDistribution.prototype = {
    init: function() {
        this.setTriggers();
        this.buildPage();
        this.setOptions();
        
        this.tooltip.init();
        triggers.emit('modal:build');
        triggers.emit('collectionManager:build');
        
//        this.getEventData();
        
        setTimeout(triggers.emitter('tweets:fetch'), 1000);
    },
    setTriggers: function() {
        
        triggers.on('event:set', this.loadTweets.bind(this, 'event'));
        triggers.on('subset:set', this.loadTweets.bind(this, 'subset'));
        
        triggers.on('events:updated', this.buildDatasetComparison.bind(this));
        triggers.on('event2:set', this.loadTweets.bind(this, 'event', true));
        
        triggers.on('counters:count', this.countFeatures.bind(this));
        triggers.on('counters:show', this.showCounts.bind(this));
    },
    buildPage: function() {
        this.body = d3.select('body').append('div')
            .attr('id', 'body');
    },
    buildDatasetComparison: function() {
        var labels = this.ops['Dataset']['Event'].labels.slice(0); // slice clones
        labels.unshift('<em>None</em>')
        var ids = this.ops['Dataset']['Event'].ids.slice(0);
        ids.unshift('none');
        
        this.ops['Dataset']['Event2'] = new Option({
            title: "Compare To Event",
            labels: labels,
            ids: ids,
            default: 0,
            callback: triggers.emitter('event2:set')
        });
        
        this.ops.buildSidebarOption('Dataset', 'Event2');
    },
    setOptions: function() {
        this.ops.panels = ['Dataset', 'Display'];//, 'Comparison'];
        
        this.ops['Dataset'] = {};
        this.ops['Display'] = {
            TopX: new Option({
                title: "Top",
                labels: ['10', '20', '100', '200', '1000'],
                ids:    ['10', '20', '100', '200', '1000'],
                default: 1,
                callback: triggers.emitter('counters:show')
            }),
            Filter: new Option({
                title: "Filter",
                labels: ['None', 'Redundant Tweets'],
                ids:    ['none', 'redun'],
                default: 1,
                callback: triggers.emitter('counters:count')
            }),
            'Exclude Stopwords': new Option({
                title: "Stopwords",
                styles: ["btn btn-sm btn-default", "btn btn-sm"],
                labels: ["Include",
                         "Exclude"],
                ids:    ['false', 'true'],
                default: 1,
                type: 'toggle',
                callback: triggers.emitter('counters:show')
            }),
//            Tables: new Option({
//                title: "Tables",
//                labels: ['n-grams', 'n-grams & co-occur', 'n-grams, co & tweets', 'n-grams, co & urls', 'All'],
//                ids:    ['n', 'nc', 'nct', 'ncu', 'nctu'],
//                default: 1,
//                callback: triggers.emitter('counters:render')
//            }),
//            TF: new Option({
//                title: "Term Frequency",
//                labels: ['&sum; Has', '&sum; Count'],
//                ids:    ['has', 'count'],
//                default: 0,
////                breakbefore: true,
//                callback: triggers.emitter('counters:show')
//            }),
            'TF Modifier': new Option({
                title: "TF Modifier",
                labels: ['Raw', 'Fraction', 'Percent', 'Log'],
                ids:    ['raw', 'fraction', 'percent', 'log'],
                default: 0,
                callback: triggers.emitter('counters:show')
            }),
//            DF: new Option({
//                title: "Doc Frequency",
//                labels: ['None', '&sum; Has', '&sum; Count'],
//                ids:    ['none', 'has', 'count'],
//                default: 0,
//                breakbefore: true,
//                callback: triggers.emitter('counters:render')
//            }),
//            'IDF': new Option({
//                title: "Inverse",
//                labels: ['1 / DF', '#Docs / DF', 'Log(#Docs / DF)'],
//                ids:    ['inv', 'ratio', 'log-ratio'],
//                default: 0,
//                callback: triggers.emitter('counters:count')
//            }),
        };
//        this.ops['Comparison'] = {};
        
        this.ops.init();
    },
    loadTweets: function(collection, compare) {
        var post = {
            collection: collection,
            collection_id: this.dataset[collection] ? this.dataset[collection].ID : undefined,
            limit: 1000
        };
        if(!post.collection_id) {
            return;
        }
        
        this.data[post.collection + post.collection_id] = {
            collection: post.collection,
            id: post.collection_id,
            tweets: {},
            tweets_arr: []
        };
        this.connection.php('tweets/get', post,
                            this.parseNewTweets.bind(this));
    },
    parseNewTweets: function(file_data, other) {
        console.log(other);
        var newTweets;
        try {
            newTweets = JSON.parse(file_data);
        } catch(err) {
            console.error(setname, file_data);
            return;
        }
        
        var setname = 'event' + this.dataset.event.ID;
        if(this.dataset.subset) 
            setname = 'subset' + this.dataset.subset.ID;
    
        // Add information to the tweets
        newTweets.forEach(function(tweet) {
            if(!(tweet in this.data[setname].tweets)) {
                this.data[setname].tweets[tweet.ID] = tweet;
                this.data[setname].tweets_arr.push(tweet);
            }
        }, this);
        
        console.log(this.data[setname].tweets_arr.length + ' Tweets Collected');
        triggers.emit('counters:count');
    },
    countFeatures: function() {
        var setname = 'event' + this.dataset.event.ID;
        if(this.dataset.subset) 
            setname = 'subset' + this.dataset.subset.ID;
        var set = this.data[setname];
        
        set.nTweets = 0;
        
        // Start Counters        
        set.counter = {};
        this.counters.forEach(function(counter) {
            set.counter[counter] = new Counter();
        });
        
        // TODO subselection of tweets
        
        // Add up ngrams
        var redundantTweetsOK = this.ops['Display']['Filter'].is('none');
        set.tweets_arr.forEach(function(tweet) {
            set.nTweets += 1;
            
            var newTweet = !set.counter.TextStripped.has(tweet.TextStripped);
            var newURL = !set.counter.ExpandedURL.has(tweet.ExpandedURL);

            if(newTweet || newURL || redundantTweetsOK) { // Aggressive redundancy check
                
                // Count usual features
                this.simpleFeatures.forEach(function(feature) {
                    set.counter[feature].incr(tweet[feature]);
                });
                
                // Get time features
                this.timeFeatures.forEach(function(feature) {
                    var time = tweet[feature];
                    time = util.formatDateToMinutes(util.date(time));
                    set.counter[feature].incr(time);
                });
                
                // Links
                this.linkFeatures.forEach(function(feature) {
                    var url = tweet[feature];
                    if(feature == 'ExpandedURL Domain') {
                        url = tweet['ExpandedURL'];
                        if(url) {
                            url = url.replace(
                                /.*:\/\/([^\/]*)\/.*/, '$1');
                        }
                    }
                    if(url) {
                        url = '<a href=' + url + ' target="_blank">' + url + '</a>';
                    }
                    set.counter[feature].incr(url);
                });
                
                // Quantities (binned)
                this.quantityFeatures.forEach(function(feature) {
                    var quantity = tweet[feature];
                    if(quantity == 0) {
                        set.counter[feature].incr(0);
                        return;
                    }
                    var log10 = Math.log(quantity) * Math.LOG10E;
                    var digits = Math.floor(log10);
                    var logdecimal = log10 - digits;
                    var magnitude = Math.floor(Math.pow(10, digits));
                    var bound = magnitude + ' to ' + (magnitude * 10 - 1);
                    
//                    if(logdecimal < .333) {
//                        bound = Math.floor(1 * Math.pow(10, digits)) + ' to ' +
//                                Math.floor(2.15 * Math.pow(10, digits));
//                    } else if (logdecimal < .663) {
//                        bound = Math.floor(2.15 * Math.pow(10, digits) + 1) + ' to ' +
//                                Math.floor(4.6 * Math.pow(10, digits));
//                    } else {
//                        bound = Math.floor(4.6 * Math.pow(10, digits) + 1) + ' to ' +
//                                Math.floor(10 * Math.pow(10, digits) - 1);
//                    }
                    
                    set.counter[feature].incr(bound);
                });
                
                // Count Text features
                var text = tweet.TextStripped.toLowerCase();
                text = text.replace(/[^\w']+/g, ' ');
                text = text.replace(/(\w)' /g, '$1 ').replace(/ '(\w)/g, ' $1');
                var words = text.split(' ');
                var tweetgrams = [new Set(), new Set(), new Set(), new Set()];

                words.forEach(function(word, wi) {
                    if(word) {
                        var gram = word;
                        set.counter['TextUnigrams'].incr(gram);
                        if(!tweetgrams[0].has(gram)) {
                            tweetgrams[0].add(gram);
//                            ngrams.NGramHasCounter[0].incr(gram);
                        }
                        if(words[wi + 1]) {
                            gram += " " + words[wi + 1];
                            set.counter['TextBigrams'].incr(gram);
                            if(!tweetgrams[1].has(gram)) {
                                tweetgrams[1].add(gram);
//                                ngrams.NGramHasCounter[1].incr(gram);
                            }
                            if(words[wi + 2]) {
                                gram += " " + words[wi + 2];
                                set.counter['TextTrigrams'].incr(gram);
                                if(!tweetgrams[2].has(gram)) {
                                    tweetgrams[2].add(gram);
//                                    ngrams.NGramHasCounter[2].incr(gram);
                                }
                            }
                        }
                        for(var wj = wi + 1; wj < words.length; wj++) { 
                            gram = word + ' & ' + words[wj];
                            if(words[wj] < word)
                                gram = words[wj] + ' & ' + word;
                            // Add co-occurance
                            if(words[wj]) {
                                set.counter['TextCooccur'].incr(gram);
                                if(!tweetgrams[3].has(gram)) {
                                    tweetgrams[3].add(gram);
//                                    ngrams.CoOccurHasCounter.incr(gram);
                                }
                            }
                        }
                    }
                });
            } // New Tweet or New URL
        }, this);
        
        triggers.emit('counters:show', setname);
    },
    showCounts: function(setname, comparesetname) {
        if(!setname) {
            var setname = 'event' + this.dataset.event.ID;
            if(this.dataset.subset) 
                setname = 'subset' + this.dataset.subset.ID;
        }
        var set = this.data[setname];
        var cmp;
//        if(comparesetname) {
//            cmp = this.data[comparesetname];
//        }
        
        var n = parseInt(this.ops['Display']['TopX'].get());

        this.body.selectAll('*').remove();
        
//        this.body.append('table')
//            .style('width', '100%')
//            .append('tr')
//            .selectAll('td')
//            .data(this.counters)
//            .enter()
//            .append('td')
        var table_containers = this.body.selectAll('div.counter_table_container')
            .data(this.counters)
            .enter()
            .append('div')
            .attr('class', 'counter_table_container');
    
        // Add header
        table_containers.append('h4')
            .html(function(d) {
                return d.replace(/([a-z])([A-Z])/g, "$1 $2");
            });
        
        table_containers.append('p')
            .html(function(d) {
                return set.counter[d].tokens + ' tokens';
            });
        
        // Add tables of counts
        table_containers.append('table')
            .attr('class', 'counter_table')
            .each(function(d, i) {
                var table = d3.select(this);
            
                var header = table.append('thead').append('tr');
                header.append('th')
                    .attr('class', 'token')
                    .html('Term');
            
                header.append('th')
                    .attr('class', 'count')
                    .html('Count');

                var top_tokens = set.counter[d].top(n);
                top_tokens = top_tokens.map(function(token_count) {
                    var entry = {
                        token: token_count.key,
                        count: token_count.value,
                        percent: token_count.value / set.nTweets
                    };
                    if(cmp) {
                        entry['count2'] = cmp.counter[d].has(token_count.key);
                        entry['percent2'] = entry['count2'] / cmp.nTweets;
                        entry['ratio'] = entry['count'] / entry['count2'];
                        entry['log-ratio'] = Math.log(entry['ratio']);
                    }
                    return entry;
                })
            
                var rows = table.append('tbody')
                    .selectAll('tr.token-count-set')
                    .data(top_tokens)
                    .enter()
                    .append('tr')
                    .attr('class', 'token-count-set');
            
                rows.append('td')
                    .attr('class', 'token');

                rows.append('td')
                    .attr('class', 'count');
            
                if(cmp) {
                    rows.append('td')
                        .attr('class', 'count-cmp');
                }
            });
        
        // Populate data
        table_containers.selectAll('tbody .token')
            .html(function(d) { return d['token']; });
        table_containers.selectAll('tbody .count')
            .html(function(d) { return d['count']; });
        table_containers.selectAll('tbody .count-cmp')
            .html(function(d) { return d['count2']; });
        
//        if(this.ops.compare)
    }
};

function initialize() {
    FD = new FeatureDistribution();
    
    FD.init();
}
window.onload = initialize;