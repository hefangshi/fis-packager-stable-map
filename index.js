/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';
module.exports = function(ret, conf, settings, opt){
    var pkgMap = {}, packed = {},
        ns = fis.config.get('namespace'),
        root = fis.project.getProjectPath();
    //construct package table
    fis.util.map(conf, function(path, patterns, index){
        if(typeof patterns === 'string'){
            patterns = [ patterns ];
        }
        if(fis.util.is(patterns, 'Array') && patterns.length){
            var pid = (ns ? ns + ':' : '') + 'p' + index,
                subpath = path.replace(/^\//, ''),
                pkg = ret.pkg[subpath] = fis.file(root, subpath);
            pkg.useHash = true;
            pkg.url = pkg.release = '/' + subpath;
            if(typeof ret.src[pkg.subpath] !== 'undefined'){
                fis.log.warning('there is a namesake file of package [' + path + ']');
            }
            pkgMap[pid] = {
                id : pid,
                file : pkg,
                regs : patterns,
                pkgs : new Array(patterns.length)
            };
        } else {
            fis.log.warning('invalid pack config [' + path + ']');
        }
    });
    
    //determine if subpath hit a pack config
    var hit = function(subpath, regs){
        for(var i = 0, len = regs.length; i < len; i++){
            var reg = regs[i];
            if(reg && fis.util.filter(subpath, reg)){
                return i;
            }
        }
        return false;
    };
    
    //pack file
    var pack = function(subpath, file, pkg){
        if(packed[subpath] || file.isImage()) return;
        if(pkg){
            var index = hit(file.subpath, pkg.regs);
            if(index !== false){
                packed[subpath] = true;
                file.requires.forEach(function(id){
                    var dep = ret.ids[id];
                    if(dep && dep.rExt === file.rExt){
                        pack(dep.subpath, dep, pkg);
                    }
                });
                var stack = pkg.pkgs[index] || [];
                stack.push(file);
                pkg.pkgs[index] = stack;
                //add packed
                return true;
            }
        } else {
            fis.util.map(pkgMap, function(pid, pkg){
                return pack(file.subpath, file, pkg);
            });
        }
    };
    
    //walk
    fis.util.map(ret.src, function(subpath, file){
        pack(subpath, file);
    });
    
    //pack
    fis.util.map(pkgMap, function(pid, pkg){
        //collect contents
        var content = '', has = [], requires = [], requireMap = {};
        pkg.pkgs.forEach(function(pkg){
            var len = pkg.length;
            pkg.forEach(function(file, index){
                content += file.getContent();
                if(index < len){
                    content += '\n';
                    if(file.rExt === '.js'){
                        content += ';';
                    }
                }
                var id = file.getId();
                ret.map.res[id].pkg = pid;
                requires = requires.concat(file.requires);
                requireMap[id] = true;
                has.push(id);
            });
        });
        pkg.file.setContent(content);
        
        //collect dependencies
        var deps = [];
        requires.forEach(function(id){
            if(!requireMap[id]){
                deps.push(id);
                requireMap[id] = true;
            }
        });
        ret.map.pkg[pid] = {
            uri  : pkg.file.getUrl(opt.hash, opt.domain),
            type : pkg.file.rExt.replace(/^\./, ''),
            has  : has,
            deps : deps
        };
    });
};