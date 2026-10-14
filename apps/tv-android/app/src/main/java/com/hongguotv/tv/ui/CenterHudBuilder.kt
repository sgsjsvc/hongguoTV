package com.hongguotv.tv.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import com.hongguotv.tv.R
import com.hongguotv.tv.TvUi

internal object CenterHudBuilder {

    fun buildPauseIndicator(context: Context): LinearLayout {
        val indicator = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            visibility = View.GONE
            isFocusable = false
            isClickable = false
            background = TvUi.surface(0xdd0f172a.toInt(), 0x33ffffff.toInt(), radius = 36f, strokeWidth = 2)
            setPadding(
                TvUi.dimen(context, R.dimen.indicator_pad_h_start),
                TvUi.dimen(context, R.dimen.indicator_pad_v),
                TvUi.dimen(context, R.dimen.indicator_pad_h_end),
                TvUi.dimen(context, R.dimen.indicator_pad_v)
            )
        }

        val iconBadge = TextView(context).apply {
            text = "❚❚"
            textSize = 12f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(TvUi.RED)
            }
        }
        val iconSize = TvUi.dimen(context, R.dimen.indicator_icon_size)
        indicator.addView(iconBadge, LinearLayout.LayoutParams(iconSize, iconSize).apply {
            marginEnd = TvUi.dimen(context, R.dimen.indicator_icon_margin_end)
        })

        val textCol = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val pauseTitle = TextView(context).apply {
            text = "播放已暂停"
            textSize = 15f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
        }
        val pauseHint = TextView(context).apply {
            text = "按遥控器确认键继续播放"
            textSize = 11.5f
            setTextColor(TvUi.TEXT_MUTED)
        }
        textCol.addView(pauseTitle)
        textCol.addView(pauseHint)
        indicator.addView(textCol)

        return indicator
    }

    data class SeekHudComponents(
        val layout: LinearLayout,
        val deltaText: TextView,
        val timeText: TextView
    )

    fun buildSeekHud(context: Context): SeekHudComponents {
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            visibility = View.GONE
            isFocusable = false
            isClickable = false
            background = TvUi.surface(0xee0b0f19.toInt(), 0x33ffffff.toInt(), radius = 32f, strokeWidth = 2)
            setPadding(
                TvUi.dimen(context, R.dimen.seek_hud_pad_h_start),
                TvUi.dimen(context, R.dimen.seek_hud_pad_v),
                TvUi.dimen(context, R.dimen.seek_hud_pad_h_end),
                TvUi.dimen(context, R.dimen.seek_hud_pad_v)
            )
        }

        val deltaText = TextView(context).apply {
            text = "▶▶ +10s"
            textSize = 14f
            setTextColor(TvUi.AMBER)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(
                TvUi.dimen(context, R.dimen.seek_hud_delta_pad_h),
                TvUi.dimen(context, R.dimen.seek_hud_delta_pad_v),
                TvUi.dimen(context, R.dimen.seek_hud_delta_pad_h),
                TvUi.dimen(context, R.dimen.seek_hud_delta_pad_v)
            )
            background = TvUi.surface(0x33fbbf24.toInt(), radius = 14f)
        }
        layout.addView(deltaText, LinearLayout.LayoutParams(-2, -2).apply {
            marginEnd = TvUi.dimen(context, R.dimen.seek_hud_delta_margin_end)
        })

        val timeText = TextView(context).apply {
            text = "00:00 / 00:00"
            textSize = 15f
            setTextColor(Color.WHITE)
            setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
        }
        layout.addView(timeText)

        return SeekHudComponents(layout, deltaText, timeText)
    }
}
