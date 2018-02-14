@import 'utils.js'

/*
Example padding object:

{
  top: 20,
  bottom: 20,
  left: 10,
  right: 10,
  conditions: {
    expression: 'w<10;h>=10',
    maxWidth: 9,
    minHeight: 10
  }
}
*/



// ****************************
//   Padding from/to layer name
// ****************************


/**
 * Return if a layer can have padding associated with it
 */
function canLayerHavePadding(layer) {
  return (layer.isMemberOfClass(MSShapeGroup) || layer.isMemberOfClass(MSSymbolInstance))
}


/**
 * Get padding from a layer's name
 * Returned as a Padding object
 */
function getPaddingFromLayer(layer) {
  if (!canLayerHavePadding(layer)) return

  var paddingString = layerPaddingString(layer)
  return paddingFromString(paddingString)
}


/**
 * Given a padding object, save it to a layer in it's name
 * Preserving the layers current name
 */
function savePaddingToLayer(padding, layer) {
  if (!canLayerHavePadding(layer)) return


  var name = layer.name().split('[')[0]

  if (!padding) {
    layer.name = name
    return
  }

  if (name.slice(-1) != ' ')
    name += ' '

  layer.name = name + '[' + paddingToString(padding) + ']'
}


/**
 * Return if a layer already has padding associated
 */
function layerHasPadding(layer) {
  if (!layer) return false

  return canLayerHavePadding(layer) && layerPaddingString(layer) != null
}


/**
 * Return the raw padding value
 * The string between '[' and ']'
 */
function layerPaddingString(layer) {
  if (!layer) return

  var split = layer.name().split('[')
  var section = split[split.length - 1]
  split = section.split(']')
  return split[0]

  // var regex = /.*\[([^]]+)\]/g
  // return firstRegexMatch(regex, layer.name())
}



// ****************************
//   Padding data transformations
// ****************************

var paddingValuesSplitter = ' ' // The string to split values, e.g. ';' or ':'
var expressionSpliter = ';'


/**
 * Given a padding object
 * Convert it to a string
 */
function paddingToString(padding) {
  var values = [padding.top, padding.right, padding.bottom, padding.left]

  if (padding.right == padding.left) {
    values.pop()

    if (padding.top == padding.bottom) {
      values.pop()

      if (padding.top == padding.right) {
        values.pop()
      }
    }
  }

  var string = values.join(paddingValuesSplitter)
  if (padding.conditions && padding.conditions.expression) {
    string += (expressionSpliter + padding.conditions.expression)
  }

  return string
}


/**
 * Given a string e.g. '20 30 10'
 * Convert it to a padding object
 */
function paddingFromString(string) {
  if (!string || string == '')
    return null

  var expressionSplit = string.split(expressionSpliter)
  var paddingValues = expressionSplit[0]

  expressionSplit.shift()

  var conditions = evaluateConditionsFromString(expressionSplit.join(expressionSpliter))

  var values = paddingValues.split(paddingValuesSplitter)

  // Remove empty strings
  values = values.filter(function(value) {
    return value != ''
  })

  var top = bottom = left = right = 0

  switch (values.length) {
    case 1:
      top = bottom = left = right = values[0]
      break
    case 2:
      top = bottom = values[0]
      left = right = values[1]
      break
    case 3:
      top = values[0]
      left = right = values[1]
      bottom = values[2]
      break
    case 4:
      top = values[0]
      right = values[1]
      bottom = values[2]
      left = values[3]
    default:
      break
  }

  var padding = {
    top: top,
    bottom: bottom,
    left: left,
    right: right
  }

  if (conditions) {
    padding.conditions = conditions
  }

  return padding
}


/**
 * Return a default padding object
 */
function defaultPadding() {
  return {
    top: 10,
    bottom: 10,
    left: 20,
    right: 20
  }
}


function evaluateConditionsFromString(string) {
  if (!string || string == '') return null

  var expressionString = string.replace(/\s/g, '').toLowerCase()
  var expressions = expressionString.split(expressionSpliter)


  var conditions = {
    expression: expressionString
  }

  expressions.forEach(function(expression) {
    var regex = /(height|h|width|w)(>=|<=|<|>|=)(\d*)/g
    var matches = regex.exec(expression)
    if (matches.length < 4) return

    var property = matches[1]
    var operator = matches[2]
    var value = matches[3]

    if (operator == '>') value++
    if (operator == '<') value--

    if (property.charAt(0) == 'h') {
      if (operator == '>' || operator == '>=' || operator == '=') {
        conditions.minHeight = value
      }
      if (operator == '<' || operator == '<=' || operator == '=') {
        conditions.maxHeight = value
      }
    } else if (property.charAt(0) == 'w') {
      if (operator == '>' || operator == '>=' || operator == '=') {
        conditions.minWidth = value
      }
      if (operator == '<' || operator == '<=' || operator == '=') {
        conditions.maxWidth = value
      }
    }
  })

  return conditions
}



function applyPaddingToLayerWithContainerRect(padding, layer, containerRect) {

  log(3, 'Applying padding to: ', layer.name(), JSON.stringify(padding))

  if (padding.right == 'x') {
    var xDiff = layer.frame().x() - containerRect.x()
    var rightDiff = (containerRect.width() - layer.frame().width() - xDiff)
    padding.right = -parseInt(rightDiff)
  }

  if (padding.left == 'x') {
    var xDiff = layer.frame().x() - containerRect.x()
    padding.left = -parseInt(xDiff)
  }

  if (padding.bottom == 'x') {
    var yDiff = layer.frame().y() - containerRect.y()
    var bottomDiff = (containerRect.height() - layer.frame().height() - yDiff)
    padding.bottom = -parseInt(bottomDiff)
  }

  if (padding.top == 'x') {
    var yDiff = layer.frame().y() - containerRect.y()
    padding.top = -parseInt(yDiff)
  }

  var left = parseFloat(padding.left) || 0
  var right = parseFloat(padding.right) || 0
  var bottom = parseFloat(padding.bottom) || 0
  var top = parseFloat(padding.top) || 0

  var x = containerRect.x() - left
  var y = containerRect.y() - top
  var width = containerRect.width() + left + right
  var height = containerRect.height() + bottom + top

  var conditions = padding.conditions
  if (conditions) {
    if (conditions.maxWidth && parseFloat(width) > parseFloat(conditions.maxWidth)) {
      width = parseFloat(conditions.maxWidth)
    }
    if (conditions.minWidth && parseFloat(width) < parseFloat(conditions.minWidth)) {
      width = parseFloat(conditions.minWidth)
    }
    if (conditions.maxHeight && parseFloat(height) > parseFloat(conditions.maxHeight)) {
      height = conditions.maxHeight
    }
    if (conditions.minHeight && parseFloat(height) < parseFloat(conditions.minHeight)) {
      height = parseFloat(conditions.minHeight)
    }
  }

  // Outset the Background's frame – by the amount of Padding
  layer.setConstrainProportions(false)
  layer.frame().setX(x)
  layer.frame().setY(y)
  layer.frame().setWidth(width)
  layer.frame().setHeight(height)

  layer.layerDidEndResize()
}
