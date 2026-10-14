package com.hongguotv.tv

import android.content.Context
import android.view.View
import android.view.ViewGroup

/** All filters stay visible; wrap to the available TV width without horizontal scrolling. */
internal class CategoryTagLayout(context: Context) : ViewGroup(context) {
    private val gap = TvUi.dimen(context, R.dimen.category_tag_gap)
    init { clipChildren = false; clipToPadding = false }

    override fun generateDefaultLayoutParams() = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT)

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val available = (width - paddingLeft - paddingRight).coerceAtLeast(0)
        var x = 0; var y = 0; var rowHeight = 0
        for (index in 0 until childCount) {
            val child = getChildAt(index)
            if (child.visibility == View.GONE) continue
            child.measure(MeasureSpec.makeMeasureSpec(available, MeasureSpec.AT_MOST), MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED))
            if (x > 0 && x + child.measuredWidth > available) { x = 0; y += rowHeight + gap; rowHeight = 0 }
            x += child.measuredWidth + gap
            rowHeight = maxOf(rowHeight, child.measuredHeight)
        }
        setMeasuredDimension(resolveSize(width, widthMeasureSpec), resolveSize(paddingTop + y + rowHeight + paddingBottom, heightMeasureSpec))
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        val end = right - left - paddingRight
        var x = paddingLeft; var y = paddingTop; var rowHeight = 0
        for (index in 0 until childCount) {
            val child = getChildAt(index)
            if (child.visibility == View.GONE) continue
            if (x > paddingLeft && x + child.measuredWidth > end) { x = paddingLeft; y += rowHeight + gap; rowHeight = 0 }
            child.layout(x, y, x + child.measuredWidth, y + child.measuredHeight)
            x += child.measuredWidth + gap
            rowHeight = maxOf(rowHeight, child.measuredHeight)
        }
    }
}
