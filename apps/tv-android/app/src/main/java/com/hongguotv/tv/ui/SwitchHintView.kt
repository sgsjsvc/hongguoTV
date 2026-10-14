package com.hongguotv.tv.ui

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.LinearLayout
import android.widget.TextView
import com.hongguotv.tv.R
import com.hongguotv.tv.TvUi

internal class SwitchHintView(context: Context) : LinearLayout(context) {

    private val titleText: TextView
    private val badgeText: TextView
    private val subtitleText: TextView
    private val spinner: TextView
    private val loadingText: TextView
    private val rotateAnimator: ObjectAnimator

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        visibility = View.GONE
        isFocusable = false
        isClickable = false
        background = TvUi.surface(0xee0b0f19.toInt(), 0x33ffffff.toInt(), radius = 32f, strokeWidth = 2)
        setPadding(
            TvUi.dimen(context, R.dimen.switch_hint_pad_h),
            TvUi.dimen(context, R.dimen.switch_hint_pad_v),
            TvUi.dimen(context, R.dimen.switch_hint_pad_h),
            TvUi.dimen(context, R.dimen.switch_hint_pad_v)
        )
        minimumWidth = TvUi.dimen(context, R.dimen.switch_hint_min_width)

        // 1. Title Row: @剧名 + 全N集 Badge
        val titleRow = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        titleText = TextView(context).apply {
            text = "@红果短剧"
            textSize = 16f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
        }
        titleRow.addView(titleText, LayoutParams(-2, -2))

        badgeText = TextView(context).apply {
            text = ""
            textSize = 11f
            setTextColor(TvUi.RED)
            setTypeface(typeface, Typeface.BOLD)
            background = TvUi.surface(0x33f43f5e.toInt(), radius = 20f)
            setPadding(
                TvUi.dimen(context, R.dimen.switch_hint_badge_pad_h),
                TvUi.dimen(context, R.dimen.switch_hint_badge_pad_v),
                TvUi.dimen(context, R.dimen.switch_hint_badge_pad_h),
                TvUi.dimen(context, R.dimen.switch_hint_badge_pad_v)
            )
            visibility = View.GONE
        }
        titleRow.addView(badgeText, LayoutParams(-2, -2).apply {
            marginStart = TvUi.dimen(context, R.dimen.indicator_icon_margin_end)
        })
        addView(titleRow, LayoutParams(-2, -2))

        // 2. Subtitle: 第 N 集 · 《剧名》
        subtitleText = TextView(context).apply {
            text = "正在准备精彩内容..."
            textSize = 13f
            setTextColor(0xffe2e8f0.toInt())
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, 4, 0, 8)
        }
        addView(subtitleText, LayoutParams(-2, -2))

        // 3. Loading Row: ◜ + 正在加载动画
        val loadingRow = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        spinner = TextView(context).apply {
            text = "◜"
            textSize = 16f
            setTextColor(TvUi.RED)
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        rotateAnimator = ObjectAnimator.ofFloat(spinner, "rotation", 0f, 360f).apply {
            duration = 1000
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
        }
        loadingRow.addView(spinner, LayoutParams(-2, -2).apply {
            marginEnd = TvUi.dimen(context, R.dimen.indicator_icon_margin_end)
        })

        loadingText = TextView(context).apply {
            text = "精彩内容加载中..."
            textSize = 11.5f
            setTextColor(TvUi.TEXT_MUTED)
        }
        loadingRow.addView(loadingText, LayoutParams(-2, -2))
        addView(loadingRow, LayoutParams(-2, -2))
    }

    fun show(title: String, subtitle: String? = null, badge: String? = null, loadingHint: String? = null) {
        titleText.text = if (title.startsWith("@")) title else "@$title"
        if (!badge.isNullOrBlank()) {
            badgeText.text = badge
            badgeText.visibility = View.VISIBLE
        } else {
            badgeText.visibility = View.GONE
        }
        if (!subtitle.isNullOrBlank()) {
            subtitleText.text = subtitle
            subtitleText.visibility = View.VISIBLE
        } else {
            subtitleText.visibility = View.GONE
        }
        if (!loadingHint.isNullOrBlank()) {
            loadingText.text = loadingHint
        } else {
            loadingText.text = "精彩内容加载中..."
        }
        visibility = View.VISIBLE
        if (!rotateAnimator.isStarted) {
            rotateAnimator.start()
        }
    }

    fun hide() {
        visibility = View.GONE
        if (rotateAnimator.isRunning || rotateAnimator.isStarted) {
            rotateAnimator.cancel()
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        if (rotateAnimator.isRunning || rotateAnimator.isStarted) {
            rotateAnimator.cancel()
        }
    }
}
