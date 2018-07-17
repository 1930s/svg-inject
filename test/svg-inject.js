/**
 * SVGInject - Simple 
 * https://github.com/iconfu/svg-inject
 *
 * Copyright (c) 2018 Iconfu <info@iconfu.com>
 * @license MIT
 */

(function(window, document) {

  'use strict';

  var NOOP = function() {};
  var ATTRIBUTE_EXCLUSION_NAMES = ['src', 'alt', 'onload'];
  var a = document.createElement('a');
  var DEFAULT_OPTIONS = {
    cache: true,
    copyAttributes: true,
    beforeInject: NOOP,
    afterInject: NOOP,
    onInjectFail: NOOP
  };

  function getAbsoluteUrl(url) {
    a.href = url;
    return a.href;
  }

  function buildSvg(svgString, absUrl) {
    var div = document.createElement('div');
    div.innerHTML = svgString;
    return div.firstChild;
  }

  // load svg
  function load(path, callback, errorCallback) {
    if (path) {
      var req = new XMLHttpRequest();

      req.onreadystatechange = function() {
        if(req.readyState == 4 && req.status == 200) {
          callback(req.responseText);
        }
      };

      req.onerror = errorCallback;

      try {
        req.open('GET', path, true);
        req.send();  
      } catch(e) {
        errorCallback(e);
      }
    }
  }

  // inject loaded svg
  function inject(img, svgString, absUrl, options) {
    if (img.__injectFailed) {
      return;
    }

    var svg = buildSvg(svgString, absUrl);

    if (options.copyAttributes) {
      injectElem = svg;
      var attributes = img.attributes;

      for (var i = 0; i < attributes.length; ++i) {
        var attribute = attributes[i];
        var attributeName = attribute.name;

        if (ATTRIBUTE_EXCLUSION_NAMES.indexOf(attributeName) == -1) {
          var attributeValue = attribute.value;

          if (attributeName == 'title') {
            // if a title attribute exists insert it as the title tag in SVG
            var title = document.createElementNS("http://www.w3.org/2000/svg", "title");
            title.textContent = attributeValue;
            svg.insertBefore(title, svg.firstChild);
          } else {
            svg.setAttribute(attributeName, attributeValue);
          }
        }
      }
    }

    var injectElem = options.beforeInject(svg, img) || svg;
    
    var parentNode = img.parentNode;
    if (parentNode) {
      parentNode.replaceChild(injectElem, img);
    }
    img.__injected = true;
    img.removeAttribute('onload');
    options.afterInject(injectElem, img);
  }

  function extendOptions() {
    var newOptions = {};
    for (var i = 0; i < arguments.length; ++i) {
      var argument = arguments[i];
      if (argument) {
        for (var key in argument) {
          newOptions[key] = argument[key];
        }
      }
    }
    return newOptions;
  }

  function insertStyleInHead(css) {
    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');

    style.type = 'text/css';
    if (style.styleSheet){
      // This is required for IE8 and below.
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
  }

  function newSVGInject(globalName, options) {
    var defaultOptions = extendOptions(DEFAULT_OPTIONS, options);
    var svgLoadCache = {};

    insertStyleInHead('img[onload*="' + globalName + '"]{visibility:hidden;}');

    var injectFail = function(img, options) {
      img.removeAttribute('onload');
      img.__injectFailed = true;
      options.onInjectFail(img);
    };

    /**
     * SVGInject
     *
     * Injects the SVG specified in the `src` attribute of the specified `img` element or array of `img` elements.
     *
     * Options:
     * cache: If set to `true` the SVG will be cached using the absolute URL. Default value is `true`.
     * copyAttributes: If set to `true` the attributes will be copied from `img` to `svg`. Dfault value is `true.
     * beforeInject: Hook before SVG is injected. The `svg` and `img` elements are passed as parameters. If any html element is returned it gets injected instead of applying the default SVG injection.
     * afterInject: Hook after SVG is injected. The `svg` and `img` elements are passed as parameters.
     * onInjectFail: Hook after SVG load fails. The `img` element is passed as an parameter.
     * 
     * @param {HTMLElement} img - an img element or an array of img elements
     * @param {Object} [options] - optional parameter with [options](#options) for this injection.
     */
    function SVGInject(img, options) {
      if (img && !img.__injected && !img.__injectFailed) {
        var length = img.length;
        var src = img.src;
        var imageCompleteOnInject = false;
        
        if (src) {
          var absUrl = getAbsoluteUrl(src);
          options = extendOptions(defaultOptions, options);
          var cache = options.cache;

          var onError = function() {
            removeEventListeners();
            injectFail(img, options);
          };

          var afterImageComplete = function() {
            removeEventListeners();

            load(absUrl, function(svgString) {
              inject(img, svgString, absUrl, options);

              if (cache) {
                var svgLoad = svgLoadCache[absUrl];
                
                for (var i = 0; i < svgLoad.length; ++i) {
                  svgLoad[i](svgString);
                }
                
                svgLoadCache[absUrl] = svgString;
              }
            }, function() {
              injectFail(img, options);
            });
          };

          var removeEventListeners = function() {
            if (imageCompleteOnInject) {
              img.onload = null;
              img.onerror = null;  
            } else {
              img.removeEventListener('load', afterImageComplete);
              img.removeEventListener('error', onError);
            }    
          };
          
          if (cache) {
            var svgLoad = svgLoadCache[src];

            if (svgLoad) {
              if (Array.isArray(svgLoad)) {
                svgLoad.push(function(svgString) {
                  inject(img, svgString, absUrl, options);
                });
              } else {
                inject(img, svgLoad, absUrl, options);
              }
              return;
            } else {
              svgLoadCache[absUrl] = [];
            }
          }

          if (img.complete) {
            imageCompleteOnInject = true;
            afterImageComplete();
          } else {
            img.addEventListener('load', afterImageComplete);
            img.addEventListener('error', onError);
            // set onload attribute to hide visibility with css selector
            img.setAttribute('onload', 'SVGInject');
          }
        } else if (length) {
          for (var i = 0; i < img.length; ++i) {
            SVGInject(img[i], options);
          }
        }    
      }
    }


    /**
     * Sets the default [options](#options) for SVGInject.
     *
     * @param {Object} [options] - default [options](#options) for an injection.
     */
    SVGInject.setOptions = function(options) {
      defaultOptions = extendOptions(defaultOptions, options);
    };

    // Create a new instance of SVGInject

    SVGInject['new'] = newSVGInject;

    /**
     * Used in `onerror Event of an `<img>` element to handle cases when the loading the original src fails (for example if file is not found or if the browser does not support SVG). This triggers a call to the options onLoadFail hook if available. The optional second parameter will be set as the new src attribute for the img element.
     *
     * @param {Object} [options] - default [options](#options) for an injection.
     */
    SVGInject.err = function(img, fallbackSrc) {
      removeEventListeners();
      injectFail(img, defaultOptions);
      if (fallbackSrc) {
        img.src = fallbackSrc;
      }
    };

    window[globalName] = SVGInject;

    return SVGInject;
  }

  var SVGInjectInstance = newSVGInject('SVGInject')

  if (typeof module == 'object' && typeof module.exports == 'object') {
    module.exports = SVGInjectInstance;
  }
})(window, document);