package com.hongguotv.tv

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

internal object TvUi {
    const val BACKGROUND = 0xff070a13.toInt()
    const val PANEL = 0xff0f172a.toInt()
    const val RED = 0xfff43f5e.toInt()
    const val RED_HOVER = 0xfffb7185.toInt()
    const val AMBER = 0xfffbbf24.toInt()
    const val TEXT_WHITE = 0xffffffff.toInt()
    const val TEXT_MUTED = 0xff94a3b8.toInt()
    const val TEXT_DIM = 0xff64748b.toInt()
    const val BORDER_SUBTLE = 0x33ffffff.toInt()

    fun dp(context: Context, value: Int) = (value * context.resources.displayMetrics.density).toInt()

    fun surface(color: Int, stroke: Int = Color.TRANSPARENT, radius: Float = 14f, strokeWidth: Int = 3) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius
        setStroke(strokeWidth, stroke)
    }

    fun pillBackground(active: Boolean = false, fillColor: Int = 0x66000000.toInt(), strokeColor: Int = 0x33ffffff.toInt(), radius: Float = 50f) = StateListDrawable().apply {
        val focusedColor = if (active) RED else 0xddf43f5e.toInt()
        addState(intArrayOf(android.R.attr.state_focused), surface(focusedColor, Color.WHITE, radius, 3))
        addState(intArrayOf(), surface(if (active) RED else fillColor, strokeColor, radius, 2))
    }

    fun focusBackground(radius: Float = 14f) = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_focused), surface(0xddf43f5e.toInt(), Color.WHITE, radius, 3))
        addState(intArrayOf(), surface(PANEL, 0x22ffffff.toInt(), radius, 2))
    }

    fun circleBackground(active: Boolean = false) = StateListDrawable().apply {
        val focused = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(if (active) RED else 0xddf43f5e.toInt())
            setStroke(3, Color.WHITE)
        }
        val normal = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(if (active) RED else 0x77000000.toInt())
            setStroke(2, 0x44ffffff.toInt())
        }
        addState(intArrayOf(android.R.attr.state_focused), focused)
        addState(intArrayOf(), normal)
    }

    fun scrimTop() = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(0xee070a13.toInt(), 0xaa070a13.toInt(), Color.TRANSPARENT)
    )

    fun scrimBottom() = GradientDrawable(
        GradientDrawable.Orientation.BOTTOM_TOP,
        intArrayOf(0xf6070a13.toInt(), 0xcc070a13.toInt(), Color.TRANSPARENT)
    )

    fun logoIcon(context: Context): View {
        return FrameLayout(context).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(RED, 0xfffb923c.toInt())
            ).apply {
                cornerRadius = dp(context, 10).toFloat()
            }
            val play = TextView(context).apply {
                text = "▶"; textSize = 15f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
            }
            addView(play, FrameLayout.LayoutParams(-1, -1, Gravity.CENTER))
        }
    }

    fun text(context: Context, value: String, size: Float = 20f) = TextView(context).apply {
        text = value; textSize = size; setTextColor(Color.WHITE)
        setPadding(dp(context, 4), dp(context, 2), dp(context, 4), dp(context, 2))
    }

    fun button(context: Context, value: String, action: () -> Unit) = Button(context).apply {
        text = value; textSize = 16f; isAllCaps = false; setTextColor(Color.WHITE)
        background = focusBackground(); minHeight = dp(context, 44)
        setPadding(dp(context, 16), dp(context, 6), dp(context, 16), dp(context, 6))
        setOnClickListener { action() }
        setOnFocusChangeListener { view, focused ->
            view.scaleX = if (focused) 1.05f else 1f
            view.scaleY = if (focused) 1.05f else 1f
            view.alpha = if (focused) 1f else .92f
        }
    }

    fun pillButton(context: Context, value: String, active: Boolean = false, action: () -> Unit) = Button(context).apply {
        text = value; textSize = 14f; isAllCaps = false; setTextColor(Color.WHITE)
        background = pillBackground(active)
        minHeight = dp(context, 36)
        setPadding(dp(context, 14), dp(context, 4), dp(context, 14), dp(context, 4))
        setOnClickListener { action() }
        setOnFocusChangeListener { view, focused ->
            view.scaleX = if (focused) 1.05f else 1f
            view.scaleY = if (focused) 1.05f else 1f
            view.alpha = if (focused) 1f else .92f
        }
    }

    fun circleButton(context: Context, icon: String, label: String = "", action: () -> Unit): LinearLayout {
        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            isFocusable = true; isClickable = true
            background = circleBackground()
            val size = dp(context, 42)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = dp(context, if (label.isNotBlank()) 6 else 10)
            }
            val textIcon = TextView(context).apply {
                text = icon; textSize = 16f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
            }
            addView(textIcon, LinearLayout.LayoutParams(-1, -1).apply { gravity = Gravity.CENTER })
            setOnClickListener { action() }
            setOnFocusChangeListener { view, focused ->
                view.scaleX = if (focused) 1.15f else 1f
                view.scaleY = if (focused) 1.15f else 1f
            }
        }
    }

    fun column(context: Context) = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    fun row(context: Context) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
    }
    fun title(context: Context, value: String) = text(context, value, 26f).apply {
        setTypeface(typeface, Typeface.BOLD)
    }
    fun time(ms: Long): String {
        val seconds = ms.coerceAtLeast(0) / 1000
        return "%02d:%02d".format(seconds / 60, seconds % 60)
    }
    fun hide(view: View) { view.visibility = View.GONE }
}
